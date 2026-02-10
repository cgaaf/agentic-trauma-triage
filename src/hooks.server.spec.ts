import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock $app/environment
let mockDev = false;
vi.mock("$app/environment", () => ({
  get dev() {
    return mockDev;
  },
}));

// Mock $env/dynamic/private
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

// Must import AFTER mocks are set up
const { isOriginAllowed } = await import("./hooks.server.js");

describe("isOriginAllowed", () => {
  beforeEach(() => {
    mockDev = false;
    mockEnv = {};
  });

  it("returns false for null origin", () => {
    expect(isOriginAllowed(null, "https://example.com")).toBe(false);
  });

  it("returns true for exact match", () => {
    expect(isOriginAllowed("https://example.com", "https://example.com")).toBe(true);
  });

  it("returns false for mismatched origin", () => {
    expect(isOriginAllowed("https://evil.com", "https://example.com")).toBe(false);
  });

  it("returns true when ALLOWED_ORIGIN override matches", () => {
    mockEnv.ALLOWED_ORIGIN = "https://preview.example.com";
    expect(isOriginAllowed("https://preview.example.com", "https://example.com")).toBe(true);
  });

  it("returns false when ALLOWED_ORIGIN override does not match", () => {
    mockEnv.ALLOWED_ORIGIN = "https://preview.example.com";
    expect(isOriginAllowed("https://evil.com", "https://example.com")).toBe(false);
  });

  describe("dev mode", () => {
    beforeEach(() => {
      mockDev = true;
    });

    it("allows localhost origin", () => {
      expect(isOriginAllowed("http://localhost:5173", "http://localhost:5174")).toBe(true);
    });

    it("allows 127.0.0.1 origin", () => {
      expect(isOriginAllowed("http://127.0.0.1:5173", "http://localhost:5174")).toBe(true);
    });

    it("rejects non-localhost origin", () => {
      expect(isOriginAllowed("https://evil.com", "http://localhost:5173")).toBe(false);
    });

    it("returns false for malformed URL origin", () => {
      expect(isOriginAllowed("not-a-url", "http://localhost:5173")).toBe(false);
    });
  });

  it("rejects localhost origin in production", () => {
    mockDev = false;
    expect(isOriginAllowed("http://localhost:5173", "https://example.com")).toBe(false);
  });
});
