import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockEnv: Record<string, string | undefined> = {};
let fetchMock: ReturnType<typeof vi.fn>;

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

const { POST } = await import("./+server.js");

function deepgramResponse(
  status: number,
  body: Record<string, unknown>,
  statusText = "OK",
): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  mockEnv = { DEEPGRAM_API_KEY: "dg_test_key" };
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("POST /api/transcribe/session", () => {
  it("returns 500 when DEEPGRAM_API_KEY is missing or invalid", async () => {
    mockEnv.DEEPGRAM_API_KEY = undefined;

    const response = await POST({} as Parameters<typeof POST>[0]);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "DEEPGRAM_API_KEY is missing or invalid in server environment.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a temporary token payload on first successful grant attempt", async () => {
    fetchMock.mockResolvedValueOnce(
      deepgramResponse(200, {
        access_token: "tmp-token-1",
        expires_in: 300,
      }),
    );

    const response = await POST({} as Parameters<typeof POST>[0]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      provider: "deepgram",
      temporary_token: "tmp-token-1",
      model: "nova-3-medical",
      language: "en-US",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: "Token dg_test_key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl_seconds: 300 }),
    });
  });

  it("retries with bare key authorization when token-prefixed header fails", async () => {
    fetchMock
      .mockResolvedValueOnce(deepgramResponse(401, { err_code: "INVALID_AUTH" }, "Unauthorized"))
      .mockResolvedValueOnce(
        deepgramResponse(200, {
          access_token: "tmp-token-2",
          expires_in: 300,
        }),
      );

    const response = await POST({} as Parameters<typeof POST>[0]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      temporary_token: "tmp-token-2",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: "Token dg_test_key" }),
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: "dg_test_key" }),
    });
  });

  it("returns summarized auth failure when all attempts are unauthorized", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(deepgramResponse(401, { message: "bad key" }, "Unauthorized"))
      .mockResolvedValueOnce(deepgramResponse(401, { message: "bad key" }, "Unauthorized"));

    const response = await POST({} as Parameters<typeof POST>[0]);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error:
        "Deepgram authentication failed. Check DEEPGRAM_API_KEY and ensure it has Member role or higher.",
    });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it("returns unavailable error when Deepgram grant service is down", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(deepgramResponse(503, { error: "unavailable" }, "Service Unavailable"))
      .mockResolvedValueOnce(
        deepgramResponse(503, { error: "unavailable" }, "Service Unavailable"),
      );

    const response = await POST({} as Parameters<typeof POST>[0]);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Deepgram temporary token service is unavailable. Please try again.",
    });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it("handles malformed successful responses with missing access token", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(deepgramResponse(200, { expires_in: 300 }))
      .mockResolvedValueOnce(deepgramResponse(200, { expires_in: 300 }));

    const response = await POST({} as Parameters<typeof POST>[0]);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Deepgram token grant failed (200 OK).",
    });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it("returns generic 502 when Deepgram request throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    const response = await POST({} as Parameters<typeof POST>[0]);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to create transcription session. Please try again.",
    });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
