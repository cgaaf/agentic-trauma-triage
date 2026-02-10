import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => {
  const rateLimitCheck = vi.fn();
  const createRateLimiter = vi.fn(() => ({ check: rateLimitCheck }));

  return {
    dev: false,
    env: {} as Record<string, string | undefined>,
    rateLimitCheck,
    createRateLimiter,
  };
});

vi.mock("$app/environment", () => ({
  get dev() {
    return mockState.dev;
  },
}));

vi.mock("$env/dynamic/private", () => ({
  env: new Proxy(
    {},
    {
      get(_target, prop: string) {
        return mockState.env[prop];
      },
    },
  ),
}));

vi.mock("$lib/server/rate-limiter.js", () => ({
  createRateLimiter: mockState.createRateLimiter,
}));

async function loadHooksModule() {
  vi.resetModules();
  return import("./hooks.server.js");
}

type EventOptions = {
  pathname?: string;
  method?: string;
  urlOrigin?: string;
  requestOrigin?: string | null;
  ip?: string;
  throwOnIpLookup?: boolean;
};

function makeEvent(options: EventOptions = {}) {
  const {
    pathname = "/api/triage",
    method = "POST",
    urlOrigin = "https://example.com",
    requestOrigin = urlOrigin,
    ip = "203.0.113.10",
    throwOnIpLookup = false,
  } = options;

  const url = new URL(pathname, urlOrigin);
  const headers = new Headers();
  if (requestOrigin !== null) {
    headers.set("origin", requestOrigin);
  }

  return {
    url,
    request: new Request(url.toString(), { method, headers }),
    getClientAddress: () => {
      if (throwOnIpLookup) {
        throw new Error("ip lookup failed");
      }
      return ip;
    },
  };
}

beforeEach(() => {
  mockState.dev = false;
  mockState.env = {
    RATE_LIMIT: "10",
    RATE_LIMIT_WINDOW_MS: "60000",
  };
  mockState.rateLimitCheck.mockReset();
  mockState.rateLimitCheck.mockReturnValue({ allowed: true });
  mockState.createRateLimiter.mockClear();
});

describe("isOriginAllowed", () => {
  it("returns false for null origin", async () => {
    const { isOriginAllowed } = await loadHooksModule();
    expect(isOriginAllowed(null, "https://example.com")).toBe(false);
  });

  it("returns true for exact match", async () => {
    const { isOriginAllowed } = await loadHooksModule();
    expect(isOriginAllowed("https://example.com", "https://example.com")).toBe(true);
  });

  it("returns false for mismatched origin", async () => {
    const { isOriginAllowed } = await loadHooksModule();
    expect(isOriginAllowed("https://evil.com", "https://example.com")).toBe(false);
  });

  it("returns true when ALLOWED_ORIGIN override matches", async () => {
    mockState.env.ALLOWED_ORIGIN = "https://preview.example.com";
    const { isOriginAllowed } = await loadHooksModule();
    expect(isOriginAllowed("https://preview.example.com", "https://example.com")).toBe(true);
  });

  it("returns false when ALLOWED_ORIGIN override does not match", async () => {
    mockState.env.ALLOWED_ORIGIN = "https://preview.example.com";
    const { isOriginAllowed } = await loadHooksModule();
    expect(isOriginAllowed("https://evil.com", "https://example.com")).toBe(false);
  });

  it("allows localhost and loopback in dev mode", async () => {
    mockState.dev = true;
    const { isOriginAllowed } = await loadHooksModule();
    expect(isOriginAllowed("http://localhost:5173", "http://localhost:4173")).toBe(true);
    expect(isOriginAllowed("http://127.0.0.1:5173", "http://localhost:4173")).toBe(true);
  });

  it("rejects malformed or non-localhost origins in dev mode", async () => {
    mockState.dev = true;
    const { isOriginAllowed } = await loadHooksModule();
    expect(isOriginAllowed("not-a-url", "http://localhost:4173")).toBe(false);
    expect(isOriginAllowed("https://evil.com", "http://localhost:4173")).toBe(false);
  });

  it("rejects localhost origin in production", async () => {
    mockState.dev = false;
    const { isOriginAllowed } = await loadHooksModule();
    expect(isOriginAllowed("http://localhost:5173", "https://example.com")).toBe(false);
  });
});

describe("handle", () => {
  it("bypasses checks for non-protected routes", async () => {
    const { handle } = await loadHooksModule();
    const event = makeEvent({
      pathname: "/health",
      requestOrigin: null,
    });
    const resolved = new Response("ok", { status: 200 });
    const resolve = vi.fn(async () => resolved);

    const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);

    expect(response).toBe(resolved);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(mockState.createRateLimiter).not.toHaveBeenCalled();
  });

  it("bypasses checks for non-POST requests to protected routes", async () => {
    const { handle } = await loadHooksModule();
    const event = makeEvent({
      pathname: "/api/triage",
      method: "GET",
      requestOrigin: null,
    });
    const resolved = new Response("ok", { status: 200 });
    const resolve = vi.fn(async () => resolved);

    const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);

    expect(response).toBe(resolved);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(mockState.createRateLimiter).not.toHaveBeenCalled();
  });

  it("rejects protected POST requests with invalid origin", async () => {
    const { handle } = await loadHooksModule();
    const event = makeEvent({
      pathname: "/api/transcribe/session",
      requestOrigin: "https://evil.com",
    });
    const resolve = vi.fn(async () => new Response("ok", { status: 200 }));

    const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden: invalid origin." });
    expect(resolve).not.toHaveBeenCalled();
    expect(mockState.createRateLimiter).not.toHaveBeenCalled();
  });

  it("applies rate limiting for protected POST requests", async () => {
    const { handle } = await loadHooksModule();
    const event = makeEvent({
      pathname: "/api/transcribe/session",
      ip: "203.0.113.88",
    });
    const resolved = new Response("ok", { status: 200 });
    const resolve = vi.fn(async () => resolved);

    const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);

    expect(response).toBe(resolved);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(mockState.createRateLimiter).toHaveBeenCalledWith({ limit: 10, windowMs: 60000 });
    expect(mockState.rateLimitCheck).toHaveBeenCalledWith("203.0.113.88");
  });

  it("returns 429 with Retry-After when limit is exceeded", async () => {
    mockState.rateLimitCheck.mockReturnValue({
      allowed: false,
      retryAfterMs: 1_500,
    });
    const { handle } = await loadHooksModule();
    const event = makeEvent();
    const resolve = vi.fn(async () => new Response("ok", { status: 200 }));

    const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("2");
    await expect(response.json()).resolves.toEqual({
      error: "Too many requests. Please try again in a minute.",
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("fails open when client IP lookup throws", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { handle } = await loadHooksModule();
    const event = makeEvent({ throwOnIpLookup: true });
    const resolved = new Response("ok", { status: 200 });
    const resolve = vi.fn(async () => resolved);

    const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);

    expect(response).toBe(resolved);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(mockState.rateLimitCheck).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});
