export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

export interface RateLimiter {
  check(ip: string, now?: number): RateLimitResult;
  _reset(): void;
}

export function createRateLimiter({ limit, windowMs }: RateLimiterOptions): RateLimiter {
  const hits = new Map<string, number[]>();
  let lastCleanup = Date.now();

  function cleanup(now: number) {
    if (now - lastCleanup < 5 * windowMs) return;
    lastCleanup = now;
    const cutoff = now - windowMs;
    for (const [ip, timestamps] of hits) {
      const valid = timestamps.filter((t) => t > cutoff);
      if (valid.length === 0) hits.delete(ip);
      else hits.set(ip, valid);
    }
  }

  return {
    check(ip: string, now = Date.now()): RateLimitResult {
      cleanup(now);
      const cutoff = now - windowMs;
      const timestamps = (hits.get(ip) ?? []).filter((t) => t > cutoff);

      if (timestamps.length >= limit) {
        const oldestInWindow = timestamps[0]!;
        const retryAfterMs = oldestInWindow + windowMs - now;
        return { allowed: false, retryAfterMs };
      }

      timestamps.push(now);
      hits.set(ip, timestamps);
      return { allowed: true };
    },

    _reset() {
      hits.clear();
      lastCleanup = Date.now();
    },
  };
}
