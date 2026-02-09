export type RecorderState = "idle" | "recording" | "transcribing";

const SILENCE_THRESHOLD = 0.01;
const SILENCE_DURATION_MS = 5_000;
const MAX_DURATION_S = 30;

export class AudioRecorder {
  state = $state<RecorderState>("idle");
  duration = $state(0);
  audioLevel = $state(0);
  error = $state("");

  onAutoStop: (() => void) | null = null;

  #mediaRecorder: MediaRecorder | null = null;
  #audioContext: AudioContext | null = null;
  #analyser: AnalyserNode | null = null;
  #stream: MediaStream | null = null;
  #chunks: Blob[] = [];
  #startTime = 0;
  #silenceSince = 0;
  #rafId = 0;

  get isIdle() {
    return this.state === "idle";
  }

  get isRecording() {
    return this.state === "recording";
  }

  get isTranscribing() {
    return this.state === "transcribing";
  }

  async start() {
    this.error = "";
    this.#chunks = [];

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
      return;
    }

    // Set up audio analysis for level metering and silence detection
    this.#audioContext = new AudioContext();
    const source = this.#audioContext.createMediaStreamSource(this.#stream);
    this.#analyser = this.#audioContext.createAnalyser();
    this.#analyser.fftSize = 256;
    source.connect(this.#analyser);

    // Prefer webm/opus, fall back to whatever the browser supports
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "";

    this.#mediaRecorder = new MediaRecorder(this.#stream, mimeType ? { mimeType } : undefined);
    this.#mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.#chunks.push(e.data);
    };

    this.#mediaRecorder.start(250); // Collect chunks every 250ms
    this.state = "recording";
    this.#startTime = Date.now();
    this.#silenceSince = 0;
    this.duration = 0;

    this.#tick();
  }

  stop() {
    if (this.#mediaRecorder?.state === "recording") {
      this.#mediaRecorder.stop();
    }
    this.#stopMonitoring();
    // State remains "recording" briefly — caller transitions via setTranscribing()
  }

  getBlob(): Blob {
    const mimeType = this.#mediaRecorder?.mimeType ?? "audio/webm";
    return new Blob(this.#chunks, { type: mimeType });
  }

  setTranscribing() {
    this.state = "transcribing";
  }

  reset() {
    this.state = "idle";
    this.duration = 0;
    this.audioLevel = 0;
  }

  destroy() {
    this.#stopMonitoring();
    this.#releaseMedia();
    this.state = "idle";
  }

  #tick() {
    if (this.state !== "recording") return;

    const elapsed = (Date.now() - this.#startTime) / 1000;
    this.duration = Math.floor(elapsed);

    // Read audio level from analyser
    if (this.#analyser) {
      const data = new Uint8Array(this.#analyser.frequencyBinCount);
      this.#analyser.getByteFrequencyData(data);

      // Compute RMS level normalized to 0-1
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const normalized = data[i] / 255;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / data.length);
      this.audioLevel = rms;

      // Silence detection
      if (rms < SILENCE_THRESHOLD) {
        if (this.#silenceSince === 0) {
          this.#silenceSince = Date.now();
        } else if (Date.now() - this.#silenceSince >= SILENCE_DURATION_MS) {
          this.#autoStop();
          return;
        }
      } else {
        this.#silenceSince = 0;
      }
    }

    // Max duration check
    if (elapsed >= MAX_DURATION_S) {
      this.#autoStop();
      return;
    }

    this.#rafId = requestAnimationFrame(() => this.#tick());
  }

  #autoStop() {
    this.stop();
    this.onAutoStop?.();
  }

  #stopMonitoring() {
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = 0;
    }
  }

  #releaseMedia() {
    this.#stream?.getTracks().forEach((t) => t.stop());
    this.#stream = null;
    this.#audioContext?.close().catch(() => {});
    this.#audioContext = null;
    this.#analyser = null;
    this.#mediaRecorder = null;
    this.#chunks = [];
  }
}
