import { describe, it, expect, vi, beforeEach } from "vitest";

let mockEnv: Record<string, string | undefined> = {};
vi.mock("$env/dynamic/private", () => ({
  env: new Proxy(
    {},
    {
      get(_target, prop: string) {
        return mockEnv[prop];
      },
    },
  ),
}));

const { isMockMode, isTranscriptionMockMode } = await import("./config.js");

describe("isMockMode", () => {
  beforeEach(() => {
    mockEnv = {};
  });

  it("returns true when ANTHROPIC_API_KEY is undefined", () => {
    expect(isMockMode()).toBe(true);
  });

  it("returns true when ANTHROPIC_API_KEY is empty string", () => {
    mockEnv.ANTHROPIC_API_KEY = "";
    expect(isMockMode()).toBe(true);
  });

  it("returns true when ANTHROPIC_API_KEY is a placeholder", () => {
    mockEnv.ANTHROPIC_API_KEY = "insert-anthropic-api-key";
    expect(isMockMode()).toBe(true);
  });

  it("returns true when MOCK_MODE is true regardless of key", () => {
    mockEnv.ANTHROPIC_API_KEY = "sk-ant-real-key-12345";
    mockEnv.MOCK_MODE = "true";
    expect(isMockMode()).toBe(true);
  });

  it("returns false with a real API key", () => {
    mockEnv.ANTHROPIC_API_KEY = "sk-ant-real-key-12345";
    expect(isMockMode()).toBe(false);
  });
});

describe("isTranscriptionMockMode", () => {
  beforeEach(() => {
    mockEnv = {};
  });

  it("returns true when DEEPGRAM_API_KEY is undefined", () => {
    expect(isTranscriptionMockMode()).toBe(true);
  });

  it("returns true when DEEPGRAM_API_KEY is a placeholder", () => {
    mockEnv.DEEPGRAM_API_KEY = "insert-deepgram-api-key";
    expect(isTranscriptionMockMode()).toBe(true);
  });

  it("returns false with a real Deepgram key", () => {
    mockEnv.DEEPGRAM_API_KEY = "dg-real-key-12345";
    expect(isTranscriptionMockMode()).toBe(false);
  });

  it("returns true when MOCK_MODE is true regardless of key", () => {
    mockEnv.DEEPGRAM_API_KEY = "dg-real-key-12345";
    mockEnv.MOCK_MODE = "true";
    expect(isTranscriptionMockMode()).toBe(true);
  });
});
