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

async function startRecorder(recorder: AudioRecorder) {
  const startPromise = recorder.start();
  for (let attempts = 0; attempts < 10 && !mockSdkState.activeConnection; attempts += 1) {
    await Promise.resolve();
  }

  if (!mockSdkState.activeConnection) {
    throw new Error("Deepgram connection was not initialized.");
  }

  mockSdkState.activeConnection.emit(mockSdkState.events.Open);
  await startPromise;
}

beforeEach(() => {
  vi.useFakeTimers();

  mockSdkState.activeConnection = null;
  MockMediaRecorder.emitStopEvent = true;
  MockMediaRecorder.finalChunk = null;
  MockMediaRecorder.stopDelayMs = 0;

  const track = { stop: vi.fn() };
  const stream = {
    getTracks: () => [track],
  } as unknown as MediaStream;

  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            provider: "deepgram",
            temporary_token: "token",
            model: "nova-3-medical",
            language: "en-US",
            keyterms: [],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
    ),
  );

  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn(async () => stream),
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
