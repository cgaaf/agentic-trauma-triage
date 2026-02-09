import { env } from "$env/dynamic/public";

export type RecorderState = "idle" | "connecting" | "recording";

export const MAX_DURATION_S =
  Number(env.PUBLIC_MAX_RECORDING_DURATION_S) || 30;
const SILENCE_TIMEOUT_MS = 5_000;
const LIVE_COMMIT_INTERVAL_MS = 1_200;
const OPENAI_REALTIME_URL = "https://api.openai.com/v1/realtime";
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
  #peerConnection: RTCPeerConnection | null = null;
  #dataChannel: RTCDataChannel | null = null;
  #stream: MediaStream | null = null;
  #startTime = 0;
  #rafId = 0;
  #silenceTimer: ReturnType<typeof setTimeout> | null = null;
  #liveCommitTimer: ReturnType<typeof setInterval> | null = null;
  #speechActive = false;
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
    this.#speechActive = false;
    this.#hasTranscription = false;
    this.#stopRequested = false;
    this.#finalizing = false;

    this.state = "connecting";

    // Fetch ephemeral token from our server
    let clientSecret: string | null;
    let isMock = false;
    try {
      const res = await fetch(SESSION_ENDPOINT, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Session creation failed" }));
        throw new Error(body.error ?? `Session creation failed (${res.status})`);
      }
      const data = await res.json();
      clientSecret = data.client_secret;
      isMock = data.mock === true;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to start transcription session.";
      this.state = "idle";
      return;
    }

    // Request microphone access
    try {
      this.#stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          this.error = "Microphone access denied. Please allow microphone permission and try again.";
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

    if (isMock) {
      this.#startMock();
      return;
    }

    // Real mode: establish WebRTC connection to OpenAI
    try {
      await this.#connectWebRTC(clientSecret!);
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to connect to transcription service.";
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

    this.#commitInputAudioBuffer(true);

    // Brief delay to catch any final transcription events
    const finalize = () => {
      if (this.#finalizing) return;
      this.#finalizing = true;
      this.#closeConnections();
      this.#releaseMedia();
      this.state = "idle";
      this.onRecordingComplete?.();
    };

    if (this.#dataChannel) {
      setTimeout(finalize, 500);
    } else {
      finalize();
    }
  }

  destroy() {
    this.#stopRequested = true;
    this.#finalizing = true;
    if (this.#mockInterval !== null) {
      clearInterval(this.#mockInterval);
      this.#mockInterval = null;
    }
    this.#stopMonitoring();
    this.#closeConnections();
    this.#releaseMedia();
    this.state = "idle";
  }

  // ── WebRTC connection ─────────────────────────────────────────────

  async #connectWebRTC(clientSecret: string) {
    const pc = new RTCPeerConnection();
    this.#peerConnection = pc;

    // Add microphone track
    for (const track of this.#stream!.getAudioTracks()) {
      pc.addTrack(track, this.#stream!);
    }

    // Create data channel for OpenAI events
    const dc = pc.createDataChannel("oai-events");
    this.#dataChannel = dc;

    dc.onmessage = (e) => this.#handleRealtimeEvent(e);

    dc.onopen = () => {
      this.state = "recording";
      this.#startTime = Date.now();
      this.duration = 0;
      this.#tick();
    };

    dc.onerror = () => {
      if (!this.#stopRequested && !this.#finalizing) {
        this.error = "Connection to transcription service lost.";
        this.#cleanup();
      }
    };

    // SDP offer/answer exchange
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for ICE candidates to be gathered before sending the SDP
    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") {
        resolve();
      } else {
        pc.addEventListener("icegatheringstatechange", () => {
          if (pc.iceGatheringState === "complete") resolve();
        });
      }
    });

    // Model is embedded in the ephemeral token — no query param needed
    const sdpResponse = await fetch(OPENAI_REALTIME_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        "Content-Type": "application/sdp",
      },
      body: pc.localDescription!.sdp,
    });

    if (!sdpResponse.ok) {
      throw new Error(`WebRTC handshake failed (${sdpResponse.status})`);
    }

    const answerSdp = await sdpResponse.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  }

  #handleRealtimeEvent(event: MessageEvent) {
    if (this.#finalizing) return;

    let data: { type: string; delta?: string; transcript?: string };
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    switch (data.type) {
      case "conversation.item.input_audio_transcription.delta":
        if (data.delta) {
          this.#pendingRealtimeSegment += data.delta;
          this.#publishRealtimeTranscript();
          this.#hasTranscription = true;
        }
        this.#resetSilenceTimer();
        break;

      case "conversation.item.input_audio_transcription.completed":
        {
          const finalizedSegment =
            data.transcript?.trim() || this.#pendingRealtimeSegment.trim();
          if (finalizedSegment) {
            this.#finalizedRealtimeSegments.push(finalizedSegment);
            this.#pendingRealtimeSegment = "";
            this.#publishRealtimeTranscript();
            this.#hasTranscription = true;
          } else {
            this.#pendingRealtimeSegment = "";
          }
        }
        this.#resetSilenceTimer();
        break;

      case "input_audio_buffer.speech_started":
        this.#speechActive = true;
        this.#startLiveCommitTimer();
        this.#clearSilenceTimer();
        break;

      case "input_audio_buffer.speech_stopped":
        this.#speechActive = false;
        this.#clearLiveCommitTimer();
        this.#startSilenceTimer();
        break;
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

  // ── Silence detection (server-VAD driven) ─────────────────────────

  #startSilenceTimer() {
    this.#clearSilenceTimer();
    if (this.#hasTranscription) {
      this.#silenceTimer = setTimeout(() => this.#autoStop(), SILENCE_TIMEOUT_MS);
    }
  }

  #resetSilenceTimer() {
    if (this.#silenceTimer !== null) {
      this.#clearSilenceTimer();
      this.#startSilenceTimer();
    }
  }

  #clearSilenceTimer() {
    if (this.#silenceTimer !== null) {
      clearTimeout(this.#silenceTimer);
      this.#silenceTimer = null;
    }
  }

  #startLiveCommitTimer() {
    if (this.#liveCommitTimer !== null) return;
    this.#liveCommitTimer = setInterval(() => {
      this.#commitInputAudioBuffer();
    }, LIVE_COMMIT_INTERVAL_MS);
  }

  #clearLiveCommitTimer() {
    if (this.#liveCommitTimer !== null) {
      clearInterval(this.#liveCommitTimer);
      this.#liveCommitTimer = null;
    }
  }

  #commitInputAudioBuffer(force = false) {
    if (!force && (this.#finalizing || this.#stopRequested || !this.#speechActive)) return;
    if (this.#dataChannel?.readyState !== "open") return;

    try {
      this.#dataChannel.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    } catch {
      // Ignore transient channel send failures during teardown.
    }
  }

  // ── Mock mode ─────────────────────────────────────────────────────

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
        // Auto-stop after mock narrative finishes
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

  // ── Duration tick and auto-stop ───────────────────────────────────

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

  // ── Cleanup helpers ───────────────────────────────────────────────

  #stopMonitoring() {
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = 0;
    }
    this.#clearSilenceTimer();
    this.#clearLiveCommitTimer();
    this.#speechActive = false;
  }

  #closeConnections() {
    this.#dataChannel?.close();
    this.#dataChannel = null;
    this.#peerConnection?.close();
    this.#peerConnection = null;
  }

  #releaseMedia() {
    this.#stream?.getTracks().forEach((t) => t.stop());
    this.#stream = null;
  }

  #cleanup() {
    this.#stopRequested = true;
    this.#finalizing = true;
    this.#stopMonitoring();
    this.#closeConnections();
    this.#releaseMedia();
    this.state = "idle";
  }
}
