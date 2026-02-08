import { describe, it, expect, beforeEach } from "vitest";
import { createRateLimiter } from "./rate-limiter.js";

const LIMIT = 3;
const WINDOW_MS = 10_000;

describe("Rate limiter", () => {
  let limiter: ReturnType<typeof createRateLimiter>;

  beforeEach(() => {
    limiter = createRateLimiter({ limit: LIMIT, windowMs: WINDOW_MS });
  });

  it("allows requests under the limit", () => {
    const now = 1_000_000;
    expect(limiter.check("1.2.3.4", now).allowed).toBe(true);
    expect(limiter.check("1.2.3.4", now + 1).allowed).toBe(true);
    expect(limiter.check("1.2.3.4", now + 2).allowed).toBe(true);
  });

  it("blocks the request that exceeds the limit", () => {
    const now = 1_000_000;
    limiter.check("1.2.3.4", now);
    limiter.check("1.2.3.4", now + 1);
    limiter.check("1.2.3.4", now + 2);

    const result = limiter.check("1.2.3.4", now + 3);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("returns correct retryAfterMs based on oldest request in window", () => {
    const now = 1_000_000;
    limiter.check("1.2.3.4", now);
    limiter.check("1.2.3.4", now + 1000);
    limiter.check("1.2.3.4", now + 2000);

    const result = limiter.check("1.2.3.4", now + 3000);
    expect(result.allowed).toBe(false);
    // Oldest is at `now`, window is 10s, so retry after (now + 10000) - (now + 3000) = 7000ms
    expect(result.retryAfterMs).toBe(7000);
  });

  it("resets the counter after the window expires", () => {
    const now = 1_000_000;
    limiter.check("1.2.3.4", now);
    limiter.check("1.2.3.4", now + 1);
    limiter.check("1.2.3.4", now + 2);

    // After window expires, should allow again
    const result = limiter.check("1.2.3.4", now + WINDOW_MS + 1);
    expect(result.allowed).toBe(true);
  });

  it("tracks IPs independently", () => {
    const now = 1_000_000;
    // Fill up IP A
    limiter.check("1.1.1.1", now);
    limiter.check("1.1.1.1", now + 1);
    limiter.check("1.1.1.1", now + 2);
    expect(limiter.check("1.1.1.1", now + 3).allowed).toBe(false);

    // IP B should still be allowed
    expect(limiter.check("2.2.2.2", now + 3).allowed).toBe(true);
  });

  it("cleanup prunes stale entries", () => {
    const now = 1_000_000;
    limiter.check("1.1.1.1", now);
    limiter.check("1.1.1.1", now + 1);
    limiter.check("1.1.1.1", now + 2);

    // Advance past the cleanup threshold (5 * windowMs) and the window
    const future = now + 5 * WINDOW_MS + 1;
    // This triggers cleanup internally; the old IP should be pruned and a new request allowed
    const result = limiter.check("1.1.1.1", future);
    expect(result.allowed).toBe(true);
  });

  it("_reset clears all state", () => {
    const now = 1_000_000;
    limiter.check("1.1.1.1", now);
    limiter.check("1.1.1.1", now + 1);
    limiter.check("1.1.1.1", now + 2);

    limiter._reset();
    expect(limiter.check("1.1.1.1", now).allowed).toBe(true);
  });
});
