import { env } from "$env/dynamic/public";
import {
  LiveTranscriptionEvents,
  createClient,
  type ListenLiveClient,
  type LiveTranscriptionEvent,
} from "@deepgram/sdk";

export type RecorderState = "idle" | "connecting" | "recording";

type TranscribeSessionResponse = {
  provider?: "deepgram" | string;
  temporary_token?: string | null;
  model?: string;
  language?: string;
  keyterms?: string[];
  error?: string;
};

export const MAX_DURATION_S = Number(env.PUBLIC_MAX_RECORDING_DURATION_S) || 30;
const SILENCE_TIMEOUT_MS = 5_000;
const KEEP_ALIVE_INTERVAL_MS = 3_000;
const MEDIA_CHUNK_MS = 250;
const MEDIA_STOP_TIMEOUT_MS = 1_000;
const CHUNK_FLUSH_TIMEOUT_MS = 1_000;
const SESSION_ENDPOINT = "/api/transcribe/session";

export class AudioRecorder {
  state = $state<RecorderState>("idle");
  duration = $state(0);
  error = $state("");

  onTranscript: ((text: string) => void) | null = null;
  onRecordingComplete: (() => void) | null = null;

  #transcript = "";
  #finalizedRealtimeSegments: string[] = [];
  #pendingRealtimeSegment = "";
  #connection: ListenLiveClient | null = null;
  #stream: MediaStream | null = null;
  #mediaRecorder: MediaRecorder | null = null;
  #startTime = 0;
  #rafId = 0;
  #silenceTimer: ReturnType<typeof setTimeout> | null = null;
  #keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  #hasTranscription = false;
  #stopRequested = false;
  #finalizing = false;
  #stopSequencePromise: Promise<void> | null = null;
  #pendingChunkSends = new Set<Promise<void>>();

  get isIdle() {
    return this.state === "idle";
  }

  get isConnecting() {
    return this.state === "connecting";
  }

  get isRecording() {
    return this.state === "recording";
  }

  get remaining() {
    return MAX_DURATION_S - this.duration;
  }

  get progress() {
    return this.duration / MAX_DURATION_S;
  }

  async start() {
    this.error = "";
    this.#transcript = "";
    this.#finalizedRealtimeSegments = [];
    this.#pendingRealtimeSegment = "";
    this.#hasTranscription = false;
    this.#stopRequested = false;
    this.#finalizing = false;
    this.#stopSequencePromise = null;
    this.#pendingChunkSends.clear();

    this.state = "connecting";

    let session: TranscribeSessionResponse;
    try {
      const res = await fetch(SESSION_ENDPOINT, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Session creation failed" }));
        throw new Error(body.error ?? `Session creation failed (${res.status})`);
      }
      session = (await res.json()) as TranscribeSessionResponse;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to start transcription session.";
      this.state = "idle";
      return;
    }

    try {
      this.#stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          this.error =
            "Microphone access denied. Please allow microphone permission and try again.";
        } else if (err.name === "NotFoundError") {
          this.error = "No microphone found. Please connect a microphone and try again.";
        } else {
          this.error = `Microphone error: ${err.message}`;
        }
      } else {
        this.error = "Could not access microphone.";
      }
      this.state = "idle";
      return;
    }

    if (!session.temporary_token) {
      this.error = "No transcription token returned by server.";
      this.#releaseMedia();
      this.state = "idle";
      return;
    }

    try {
      await this.#connectWebSocket(
        session.temporary_token,
        session.model ?? "nova-3-medical",
        session.language ?? "en-US",
        Array.isArray(session.keyterms) ? session.keyterms : [],
      );
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : "Failed to connect to transcription service.";
      this.#releaseMedia();
      this.state = "idle";
    }
  }

  stop() {
    if (this.#stopRequested || this.#finalizing) return;
    this.#stopRequested = true;

    void this.#runStopSequence();
  }

  destroy() {
    this.#stopRequested = true;
    this.#finalizing = true;

    this.#stopMonitoring();
    this.#stopMediaRecorder();
    this.#closeConnection();
    this.#releaseMedia();
    this.#pendingChunkSends.clear();
    this.state = "idle";
  }

  // ── WebSocket connection ─────────────────────────────────────────

  async #connectWebSocket(token: string, model: string, language: string, keyterms: string[]) {
    const deepgramClient = createClient({ accessToken: token });
    const connection = deepgramClient.listen.live({
      model,
      language,
      interim_results: true,
      smart_format: true,
      punctuate: true,
      endpointing: 300,
      vad_events: true,
      utterance_end_ms: 1000,
      keyterm: keyterms.filter((term) => term.trim().length > 0),
    });

    this.#connection = connection;

    await new Promise<void>((resolve, reject) => {
      let hasOpened = false;
      let settled = false;

      const rejectOnce = (message: string) => {
        if (settled) return;
        settled = true;
        this.#closeConnection();
        reject(new Error(message));
      };

      const resolveOnce = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      connection.on(LiveTranscriptionEvents.Open, async () => {
        hasOpened = true;
        try {
          this.#startMediaRecorder();
          this.#startKeepAliveTimer();
          this.state = "recording";
          this.#startTime = Date.now();
          this.duration = 0;
          this.#tick();
          resolveOnce();
        } catch (err) {
          rejectOnce(err instanceof Error ? err.message : "Failed to start microphone streaming.");
        }
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data) =>
        this.#handleTranscriptEvent(data),
      );
      connection.on(LiveTranscriptionEvents.SpeechStarted, () => this.#clearSilenceTimer());
      connection.on(LiveTranscriptionEvents.UtteranceEnd, () => this.#startSilenceTimer());

      connection.on(LiveTranscriptionEvents.Error, (err: unknown) => {
        const message = this.#extractRealtimeErrorMessage(err);
        if (!hasOpened) {
          rejectOnce(message);
          return;
        }

        if (!this.#stopRequested && !this.#finalizing) {
          this.error = message;
          this.#cleanup();
        }
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        if (!hasOpened) {
          rejectOnce("Transcription WebSocket closed before ready.");
          return;
        }

        if (this.#stopRequested || this.#finalizing) {
          this.#completeStop();
          return;
        }

        this.error = "Connection to transcription service lost.";
        this.#cleanup();
      });
    });
  }

  #startMediaRecorder() {
    if (!this.#stream) {
      throw new Error("Microphone stream is not available.");
    }

    const mimeType = this.#pickSupportedMimeType();
    const recorder = mimeType
      ? new MediaRecorder(this.#stream, { mimeType })
      : new MediaRecorder(this.#stream);

    recorder.ondataavailable = async (event) => {
      if (!event.data || event.data.size === 0) return;

      const sendPromise = (async () => {
        if (!this.#connection) return;

        try {
          const audioBuffer = await event.data.arrayBuffer();
          this.#connection?.send(audioBuffer);
        } catch (err) {
          if (this.#stopRequested || this.#finalizing) return;
          console.warn("[AudioRecorder] Failed to send audio chunk:", err);
          this.error = "Audio transmission interrupted. Your recording may be incomplete.";
          this.#cleanup();
        }
      })();

      this.#trackPendingChunkSend(sendPromise);
    };

    recorder.onerror = () => {
      if (!this.#stopRequested && !this.#finalizing) {
        this.error = "Microphone recording failed.";
        this.#cleanup();
      }
    };

    recorder.start(MEDIA_CHUNK_MS);
    this.#mediaRecorder = recorder;
  }

  #pickSupportedMimeType(): string | undefined {
    if (typeof MediaRecorder.isTypeSupported !== "function") {
      return undefined;
    }

    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

    for (const candidate of candidates) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  #stopMediaRecorder() {
    if (!this.#mediaRecorder) return;

    if (this.#mediaRecorder.state !== "inactive") {
      try {
        this.#mediaRecorder.stop();
      } catch {
        // Ignore recorder stop errors during teardown.
      }
    }

    this.#mediaRecorder = null;
  }

  #trackPendingChunkSend(sendPromise: Promise<void>) {
    this.#pendingChunkSends.add(sendPromise);
    void sendPromise.finally(() => {
      this.#pendingChunkSends.delete(sendPromise);
    });
  }

  async #stopMediaRecorderGracefully() {
    const recorder = this.#mediaRecorder;
    if (!recorder) return;

    if (recorder.state === "inactive") {
      this.#mediaRecorder = null;
      return;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        recorder.removeEventListener("stop", onStop);
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
      };

      const settle = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      const onStop = () => {
        settle();
      };

      recorder.addEventListener("stop", onStop, { once: true });
      timeoutId = setTimeout(() => settle(), MEDIA_STOP_TIMEOUT_MS);

      try {
        recorder.stop();
      } catch {
        settle();
      }
    });

    this.#mediaRecorder = null;
  }

  async #flushPendingChunkSends() {
    if (this.#pendingChunkSends.size === 0) return;

    const deadline = Date.now() + CHUNK_FLUSH_TIMEOUT_MS;
    while (this.#pendingChunkSends.size > 0) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;

      const pending = Array.from(this.#pendingChunkSends);
      await Promise.race([
        Promise.allSettled(pending).then(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, remainingMs)),
      ]);
    }
  }

  async #runStopSequence() {
    if (this.#stopSequencePromise) return this.#stopSequencePromise;

    this.#stopSequencePromise = (async () => {
      this.#stopMonitoring();
      await this.#stopMediaRecorderGracefully();
      await this.#flushPendingChunkSends();

      if (this.#connection) {
        this.#finalizeConnection();
        setTimeout(() => this.#requestCloseConnection(), 150);
        setTimeout(() => this.#completeStop(), 900);
        return;
      }

      this.#completeStop();
    })();

    try {
      await this.#stopSequencePromise;
    } finally {
      this.#stopSequencePromise = null;
    }
  }

  #startKeepAliveTimer() {
    if (this.#keepAliveTimer !== null) return;

    this.#keepAliveTimer = setInterval(() => {
      try {
        this.#connection?.keepAlive();
      } catch (err) {
        if (this.#stopRequested || this.#finalizing) return;
        console.warn("[AudioRecorder] Keep-alive failed:", err);
        this.error = "Connection to transcription service lost.";
        this.#cleanup();
      }
    }, KEEP_ALIVE_INTERVAL_MS);
  }

  #clearKeepAliveTimer() {
    if (this.#keepAliveTimer !== null) {
      clearInterval(this.#keepAliveTimer);
      this.#keepAliveTimer = null;
    }
  }

  #closeConnection() {
    const connection = this.#connection;
    this.#connection = null;
    if (!connection) return;
    try {
      connection.requestClose();
    } catch {
      // Ignore request-close failures during teardown.
    }
    try {
      connection.disconnect();
    } catch {
      // Ignore disconnect failures during teardown.
    }
  }

  #handleTranscriptEvent(data: LiveTranscriptionEvent) {
    if (this.#finalizing) return;

    const transcript = data.channel?.alternatives?.[0]?.transcript?.trim() ?? "";

    if (data.is_final) {
      if (transcript) {
        const lastFinal =
          this.#finalizedRealtimeSegments[this.#finalizedRealtimeSegments.length - 1];
        if (lastFinal !== transcript) {
          this.#finalizedRealtimeSegments.push(transcript);
          this.#hasTranscription = true;
        }
      }
      this.#pendingRealtimeSegment = "";
      this.#publishRealtimeTranscript();
    } else if (transcript) {
      this.#pendingRealtimeSegment = transcript;
      this.#hasTranscription = true;
      this.#publishRealtimeTranscript();
    }

    if (transcript) this.#clearSilenceTimer();

    if (data.speech_final || data.from_finalize) {
      this.#startSilenceTimer();
    }
  }

  #extractRealtimeErrorMessage(err: unknown): string {
    if (typeof err === "string" && err.trim()) {
      return err;
    }

    if (err && typeof err === "object") {
      const withMessage = err as {
        message?: string;
        statusCode?: number;
        error?: { message?: string };
      };

      if (typeof withMessage.statusCode === "number") {
        return `Transcription connection failed (${withMessage.statusCode}).`;
      }

      if (typeof withMessage.message === "string" && withMessage.message.trim()) {
        return withMessage.message;
      }

      if (
        withMessage.error &&
        typeof withMessage.error.message === "string" &&
        withMessage.error.message.trim()
      ) {
        return withMessage.error.message;
      }
    }

    return "Connection to transcription service lost.";
  }

  #finalizeConnection() {
    if (!this.#connection) return;

    try {
      this.#connection.finalize();
    } catch (err) {
      console.warn("[AudioRecorder] Failed to finalize transcription:", err);
    }
  }

  #requestCloseConnection() {
    if (!this.#connection) return;

    try {
      this.#connection.requestClose();
    } catch {
      // Ignore close request failures during teardown.
    }
  }

  #publishRealtimeTranscript() {
    const parts = [...this.#finalizedRealtimeSegments];
    const pending = this.#pendingRealtimeSegment.trim();
    if (pending) {
      parts.push(pending);
    }

    const nextTranscript = parts.join(" ");
    if (nextTranscript !== this.#transcript) {
      this.#transcript = nextTranscript;
      this.onTranscript?.(this.#transcript);
    }
  }

  // ── Silence detection ───────────────────────────────────────────

  #startSilenceTimer() {
    this.#clearSilenceTimer();
    if (this.#hasTranscription) {
      this.#silenceTimer = setTimeout(() => this.#autoStop(), SILENCE_TIMEOUT_MS);
    }
  }

  #clearSilenceTimer() {
    if (this.#silenceTimer !== null) {
      clearTimeout(this.#silenceTimer);
      this.#silenceTimer = null;
    }
  }

  // ── Duration tick and auto-stop ─────────────────────────────────

  #tick() {
    if (this.state !== "recording") return;

    const elapsed = (Date.now() - this.#startTime) / 1000;
    this.duration = Math.floor(elapsed);

    if (elapsed >= MAX_DURATION_S) {
      this.#autoStop();
      return;
    }

    this.#rafId = requestAnimationFrame(() => this.#tick());
  }

  #autoStop() {
    this.stop();
  }

  // ── Cleanup helpers ─────────────────────────────────────────────

  #stopMonitoring() {
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = 0;
    }

    this.#clearSilenceTimer();
    this.#clearKeepAliveTimer();
  }

  #releaseMedia() {
    this.#stream?.getTracks().forEach((track) => track.stop());
    this.#stream = null;
  }

  #completeStop() {
    if (this.#finalizing) return;

    this.#finalizing = true;
    this.#stopMonitoring();
    this.#stopMediaRecorder();
    this.#pendingChunkSends.clear();
    this.#closeConnection();
    this.#releaseMedia();
    this.state = "idle";
    try {
      this.onRecordingComplete?.();
    } catch (err) {
      console.error("[AudioRecorder] onRecordingComplete callback failed:", err);
    }
  }

  #cleanup() {
    this.#stopRequested = true;
    this.#finalizing = true;
    this.#stopMonitoring();
    this.#stopMediaRecorder();
    this.#pendingChunkSends.clear();
    this.#closeConnection();
    this.#releaseMedia();
    this.state = "idle";
  }
}
