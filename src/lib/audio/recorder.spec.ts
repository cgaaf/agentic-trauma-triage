import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioRecorder } from "./recorder.svelte.js";

type EventHandler = (...args: unknown[]) => void;

type MockConnection = {
  on: (event: string, handler: EventHandler) => void;
  emit: (event: string, payload?: unknown) => void;
  send: ReturnType<typeof vi.fn>;
  finalize: ReturnType<typeof vi.fn>;
  requestClose: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  keepAlive: ReturnType<typeof vi.fn>;
};

type MockBlob = {
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

const mockSdkState = vi.hoisted(() => ({
  events: {
    Open: "Open",
    Transcript: "Transcript",
    SpeechStarted: "SpeechStarted",
    UtteranceEnd: "UtteranceEnd",
    Error: "Error",
    Close: "Close",
  },
  activeConnection: null as MockConnection | null,
}));

let fetchMock: ReturnType<typeof vi.fn>;
let getUserMediaMock: ReturnType<typeof vi.fn>;
let streamTrackStop: ReturnType<typeof vi.fn>;

function createMockConnection(): MockConnection {
  const handlers = new Map<string, EventHandler[]>();

  return {
    on(event: string, handler: EventHandler) {
      const existing = handlers.get(event) ?? [];
      handlers.set(event, [...existing, handler]);
    },
    emit(event: string, payload?: unknown) {
      const callbacks = handlers.get(event) ?? [];
      for (const callback of callbacks) {
        callback(payload);
      }
    },
    send: vi.fn(),
    finalize: vi.fn(),
    requestClose: vi.fn(),
    disconnect: vi.fn(),
    keepAlive: vi.fn(),
  };
}

vi.mock("@deepgram/sdk", () => ({
  LiveTranscriptionEvents: mockSdkState.events,
  createClient: vi.fn(() => ({
    listen: {
      live: vi.fn(() => {
        mockSdkState.activeConnection = createMockConnection();
        return mockSdkState.activeConnection;
      }),
    },
  })),
}));

class MockMediaRecorder {
  static emitStopEvent = true;
  static finalChunk: MockBlob | null = null;
  static stopDelayMs = 0;

  static isTypeSupported(_mimeType: string) {
    return true;
  }

  state: RecordingState = "inactive";
  ondataavailable: ((event: BlobEvent) => void | Promise<void>) | null = null;
  onerror: ((event: Event) => void) | null = null;

  #stopListeners = new Set<() => void>();

  start(_timeslice?: number) {
    this.state = "recording";
  }

  stop() {
    if (this.state === "inactive") {
      return;
    }

    this.state = "inactive";
    setTimeout(() => {
      if (MockMediaRecorder.finalChunk && this.ondataavailable) {
        this.ondataavailable({ data: MockMediaRecorder.finalChunk } as BlobEvent);
      }

      if (!MockMediaRecorder.emitStopEvent) {
        return;
      }

      for (const listener of this.#stopListeners) {
        listener();
      }
    }, MockMediaRecorder.stopDelayMs);
  }

  addEventListener(event: string, listener: () => void) {
    if (event === "stop") {
      this.#stopListeners.add(listener);
    }
  }

  removeEventListener(event: string, listener: () => void) {
    if (event === "stop") {
      this.#stopListeners.delete(listener);
    }
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function sessionResponse(body: Record<string, unknown>, status = 200, statusText = "OK"): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

async function waitForConnectionInitialization() {
  for (let attempts = 0; attempts < 10 && !mockSdkState.activeConnection; attempts += 1) {
    await Promise.resolve();
  }

  if (!mockSdkState.activeConnection) {
    throw new Error("Deepgram connection was not initialized.");
  }

  return mockSdkState.activeConnection;
}

async function startRecorder(recorder: AudioRecorder) {
  const startPromise = recorder.start();
  const connection = await waitForConnectionInitialization();
  connection.emit(mockSdkState.events.Open);
  await startPromise;
  return connection;
}

beforeEach(() => {
  vi.useFakeTimers();

  mockSdkState.activeConnection = null;
  MockMediaRecorder.emitStopEvent = true;
  MockMediaRecorder.finalChunk = null;
  MockMediaRecorder.stopDelayMs = 0;

  streamTrackStop = vi.fn();
  const track = { stop: streamTrackStop };
  const stream = {
    getTracks: () => [track],
  } as unknown as MediaStream;

  fetchMock = vi.fn(async () =>
    sessionResponse({
      provider: "deepgram",
      temporary_token: "token",
      model: "nova-3-medical",
      language: "en-US",
      keyterms: [],
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  getUserMediaMock = vi.fn(async () => stream);
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: getUserMediaMock,
    },
  });
  vi.stubGlobal("MediaRecorder", MockMediaRecorder as unknown as typeof MediaRecorder);
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("AudioRecorder stop sequencing", () => {
  it("finalizes after the trailing chunk has been sent", async () => {
    const lastChunkBuffer = deferred<ArrayBuffer>();
    MockMediaRecorder.finalChunk = {
      size: 10,
      arrayBuffer: vi.fn(() => lastChunkBuffer.promise),
    };

    const recorder = new AudioRecorder();
    await startRecorder(recorder);

    recorder.stop();
    await vi.advanceTimersByTimeAsync(0);

    expect(mockSdkState.activeConnection!.send).not.toHaveBeenCalled();
    expect(mockSdkState.activeConnection!.finalize).not.toHaveBeenCalled();

    lastChunkBuffer.resolve(new ArrayBuffer(16));
    await vi.advanceTimersByTimeAsync(1_000);

    expect(mockSdkState.activeConnection!.send).toHaveBeenCalledTimes(1);
    expect(mockSdkState.activeConnection!.finalize).toHaveBeenCalledTimes(1);
    expect(mockSdkState.activeConnection!.send.mock.invocationCallOrder[0]).toBeLessThan(
      mockSdkState.activeConnection!.finalize.mock.invocationCallOrder[0],
    );
  });

  it("keeps stop idempotent when called multiple times", async () => {
    MockMediaRecorder.finalChunk = {
      size: 1,
      arrayBuffer: vi.fn(async () => new ArrayBuffer(4)),
    };

    const recorder = new AudioRecorder();
    const onComplete = vi.fn();
    recorder.onRecordingComplete = onComplete;

    await startRecorder(recorder);

    recorder.stop();
    recorder.stop();

    await vi.runAllTimersAsync();

    expect(mockSdkState.activeConnection!.finalize).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("falls back to timeout when recorder stop event never arrives", async () => {
    MockMediaRecorder.emitStopEvent = false;

    const recorder = new AudioRecorder();
    await startRecorder(recorder);

    recorder.stop();

    await vi.advanceTimersByTimeAsync(999);
    expect(mockSdkState.activeConnection!.finalize).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(mockSdkState.activeConnection!.finalize).toHaveBeenCalledTimes(1);
  });
});

describe("AudioRecorder startup and lifecycle", () => {
  it("returns to idle with server error when session creation fails", async () => {
    fetchMock.mockResolvedValueOnce(
      sessionResponse({ error: "Session creation failed from API" }, 502, "Bad Gateway"),
    );
    const recorder = new AudioRecorder();

    await recorder.start();

    expect(recorder.isIdle).toBe(true);
    expect(recorder.error).toBe("Session creation failed from API");
    expect(mockSdkState.activeConnection).toBeNull();
  });

  it("returns to idle and releases media when temporary token is missing", async () => {
    fetchMock.mockResolvedValueOnce(
      sessionResponse({
        provider: "deepgram",
        model: "nova-3-medical",
        language: "en-US",
        keyterms: [],
      }),
    );
    const recorder = new AudioRecorder();

    await recorder.start();

    expect(recorder.isIdle).toBe(true);
    expect(recorder.error).toBe("No transcription token returned by server.");
    expect(streamTrackStop).toHaveBeenCalledTimes(1);
    expect(mockSdkState.activeConnection).toBeNull();
  });

  it("maps NotAllowedError from getUserMedia to a permission message", async () => {
    getUserMediaMock.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
    const recorder = new AudioRecorder();

    await recorder.start();

    expect(recorder.isIdle).toBe(true);
    expect(recorder.error).toBe(
      "Microphone access denied. Please allow microphone permission and try again.",
    );
  });

  it("maps NotFoundError from getUserMedia to a missing microphone message", async () => {
    getUserMediaMock.mockRejectedValueOnce(new DOMException("No device", "NotFoundError"));
    const recorder = new AudioRecorder();

    await recorder.start();

    expect(recorder.isIdle).toBe(true);
    expect(recorder.error).toBe("No microphone found. Please connect a microphone and try again.");
  });

  it("handles websocket errors before Open by returning to idle with formatted error", async () => {
    const recorder = new AudioRecorder();
    const startPromise = recorder.start();
    const connection = await waitForConnectionInitialization();

    connection.emit(mockSdkState.events.Error, { statusCode: 401 });
    await startPromise;

    expect(recorder.isIdle).toBe(true);
    expect(recorder.error).toBe("Transcription connection failed (401).");
    expect(connection.requestClose).toHaveBeenCalledTimes(1);
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
  });

  it("cleans up and surfaces error when keep-alive fails during recording", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const recorder = new AudioRecorder();
    const connection = await startRecorder(recorder);
    connection.keepAlive.mockImplementation(() => {
      throw new Error("network lost");
    });

    await vi.advanceTimersByTimeAsync(3_000);

    expect(recorder.isIdle).toBe(true);
    expect(recorder.error).toBe("Connection to transcription service lost.");
    expect(connection.requestClose).toHaveBeenCalledTimes(1);
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
    consoleWarnSpy.mockRestore();
  });

  it("deduplicates consecutive duplicate final transcript segments", async () => {
    const recorder = new AudioRecorder();
    const onTranscript = vi.fn();
    recorder.onTranscript = onTranscript;
    const connection = await startRecorder(recorder);

    connection.emit(mockSdkState.events.Transcript, {
      channel: { alternatives: [{ transcript: "Patient GCS twelve" }] },
      is_final: true,
    });
    connection.emit(mockSdkState.events.Transcript, {
      channel: { alternatives: [{ transcript: "Patient GCS twelve" }] },
      is_final: true,
    });
    connection.emit(mockSdkState.events.Transcript, {
      channel: { alternatives: [{ transcript: "SBP ninety" }] },
      is_final: true,
    });

    expect(onTranscript).toHaveBeenCalledTimes(2);
    expect(onTranscript.mock.calls[0]?.[0]).toBe("Patient GCS twelve");
    expect(onTranscript.mock.calls[1]?.[0]).toBe("Patient GCS twelve SBP ninety");
  });

  it("destroy tears down resources without calling completion callback", async () => {
    const recorder = new AudioRecorder();
    const onComplete = vi.fn();
    recorder.onRecordingComplete = onComplete;
    const connection = await startRecorder(recorder);

    recorder.destroy();

    expect(recorder.isIdle).toBe(true);
    expect(streamTrackStop).toHaveBeenCalledTimes(1);
    expect(connection.requestClose).toHaveBeenCalledTimes(1);
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("swallows onRecordingComplete callback errors during stop", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const recorder = new AudioRecorder();
    const onComplete = vi.fn(() => {
      throw new Error("callback failed");
    });
    recorder.onRecordingComplete = onComplete;
    await startRecorder(recorder);

    recorder.stop();
    await vi.runAllTimersAsync();

    expect(recorder.isIdle).toBe(true);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    consoleErrorSpy.mockRestore();
  });
});
