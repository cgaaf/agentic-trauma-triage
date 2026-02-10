import { describe, it, expect } from "vitest";
import {
  normalizeDeepgramApiKey,
  buildDeepgramAuthHeaders,
  summarizeDeepgramGrantError,
  type DeepgramGrantAttempt,
} from "./helpers.js";

describe("normalizeDeepgramApiKey", () => {
  it("returns empty string for undefined", () => {
    expect(normalizeDeepgramApiKey(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(normalizeDeepgramApiKey("")).toBe("");
  });

  it("strips surrounding quotes", () => {
    expect(normalizeDeepgramApiKey('"my-key"')).toBe("my-key");
    expect(normalizeDeepgramApiKey("'my-key'")).toBe("my-key");
  });

  it("strips Token prefix", () => {
    expect(normalizeDeepgramApiKey("Token abc123")).toBe("abc123");
  });

  it("strips Bearer prefix (case-insensitive)", () => {
    expect(normalizeDeepgramApiKey("Bearer abc123")).toBe("abc123");
    expect(normalizeDeepgramApiKey("bearer abc123")).toBe("abc123");
  });

  it("trims whitespace", () => {
    expect(normalizeDeepgramApiKey("  my-key  ")).toBe("my-key");
  });

  it("returns bare key unchanged", () => {
    expect(normalizeDeepgramApiKey("abc123def456")).toBe("abc123def456");
  });
});

describe("buildDeepgramAuthHeaders", () => {
  it("returns array of two elements", () => {
    const result = buildDeepgramAuthHeaders("my-key");
    expect(result).toHaveLength(2);
  });

  it("first element is Token-prefixed", () => {
    const result = buildDeepgramAuthHeaders("my-key");
    expect(result[0]).toBe("Token my-key");
  });

  it("second element is bare key", () => {
    const result = buildDeepgramAuthHeaders("my-key");
    expect(result[1]).toBe("my-key");
  });
});

describe("summarizeDeepgramGrantError", () => {
  function makeAttempt(overrides: Partial<DeepgramGrantAttempt> = {}): DeepgramGrantAttempt {
    return {
      ok: false,
      status: 400,
      statusText: "Bad Request",
      bodyText: "",
      accessToken: null,
      ...overrides,
    };
  }

  it("returns generic message for empty attempts array", () => {
    expect(summarizeDeepgramGrantError([])).toBe("Failed to create transcription session.");
  });

  it("returns auth failure message for 401", () => {
    const msg = summarizeDeepgramGrantError([makeAttempt({ status: 401 })]);
    expect(msg).toContain("authentication failed");
  });

  it("returns auth failure message for 403", () => {
    const msg = summarizeDeepgramGrantError([makeAttempt({ status: 403 })]);
    expect(msg).toContain("authentication failed");
  });

  it("returns service unavailable message for 500+", () => {
    const msg = summarizeDeepgramGrantError([makeAttempt({ status: 500 })]);
    expect(msg).toContain("unavailable");
  });

  it("returns service unavailable message for 503", () => {
    const msg = summarizeDeepgramGrantError([makeAttempt({ status: 503 })]);
    expect(msg).toContain("unavailable");
  });

  it("includes status code for other errors", () => {
    const msg = summarizeDeepgramGrantError([
      makeAttempt({ status: 422, statusText: "Unprocessable Entity" }),
    ]);
    expect(msg).toContain("422");
    expect(msg).toContain("Unprocessable Entity");
  });
});
