import { env } from "$env/dynamic/public";
import {
  LiveTranscriptionEvents,
  createClient,
  type ListenLiveClient,
  type LiveTranscriptionEvent,
} from "@deepgram/sdk";

export type RecorderState = "idle" | "connecting" | "recording";

type TranscribeSessionResponse = {
  mock?: boolean;
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
const SESSION_ENDPOINT = "/api/transcribe/session";

const MOCK_NARRATIVE =
  "45-year-old male involved in a high-speed MVC, " +
  "unrestrained driver. GCS 12, SBP 88, HR 120, RR 28. " +
  "Obvious deformity to the left femur with significant swelling. " +
  "Complaining of chest pain with decreased breath sounds on the left side. " +
  "Two large-bore IVs established, one liter normal saline bolus initiated.";

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
  #mockInterval: ReturnType<typeof setInterval> | null = null;
  #stopRequested = false;
  #finalizing = false;

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

    if (session.mock === true) {
      this.#startMock();
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

    if (this.#mockInterval !== null) {
      clearInterval(this.#mockInterval);
      this.#mockInterval = null;
    }

    this.#stopMonitoring();
    this.#stopMediaRecorder();

    if (this.#connection) {
      this.#finalizeConnection();
      setTimeout(() => this.#requestCloseConnection(), 150);
      setTimeout(() => this.#completeStop(), 900);
      return;
    }

    this.#completeStop();
  }

  destroy() {
    this.#stopRequested = true;
    this.#finalizing = true;

    if (this.#mockInterval !== null) {
      clearInterval(this.#mockInterval);
      this.#mockInterval = null;
    }

    this.#stopMonitoring();
    this.#stopMediaRecorder();
    this.#closeConnection();
    this.#releaseMedia();
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
      if (!this.#connection) return;

      try {
        const audioBuffer = await event.data.arrayBuffer();
        this.#connection.send(audioBuffer);
      } catch {
        // Ignore transient errors while the stream is shutting down.
      }
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

  #startKeepAliveTimer() {
    if (this.#keepAliveTimer !== null) return;

    this.#keepAliveTimer = setInterval(() => {
      try {
        this.#connection?.keepAlive();
      } catch {
        // Ignore keep-alive errors while shutting down.
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
    } catch {
      // Ignore finalize failures during teardown.
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

  // ── Mock mode ───────────────────────────────────────────────────

  #startMock() {
    this.state = "recording";
    this.#startTime = Date.now();
    this.duration = 0;
    this.#tick();

    const words = MOCK_NARRATIVE.split(" ");
    let wordIndex = 0;

    this.#mockInterval = setInterval(() => {
      if (wordIndex >= words.length) {
        clearInterval(this.#mockInterval!);
        this.#mockInterval = null;
        setTimeout(() => {
          if (!this.#stopRequested && !this.#finalizing) this.#autoStop();
        }, 500);
        return;
      }

      if (wordIndex > 0) this.#transcript += " ";
      this.#transcript += words[wordIndex];
      wordIndex++;
      this.#hasTranscription = true;
      this.onTranscript?.(this.#transcript);
    }, 150);
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
    this.#closeConnection();
    this.#releaseMedia();
    this.state = "idle";
    this.onRecordingComplete?.();
  }

  #cleanup() {
    this.#stopRequested = true;
    this.#finalizing = true;
    this.#stopMonitoring();
    this.#stopMediaRecorder();
    this.#closeConnection();
    this.#releaseMedia();
    this.state = "idle";
  }
}
