import type { Handle } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { createRateLimiter, type RateLimiter } from "$lib/server/rate-limiter.js";

/**
 * Soft in-memory rate limiter for protected API endpoints (/api/triage, /api/transcribe/session).
 *
 * ── Configuration (environment variables, required) ─────────────────
 *
 *   RATE_LIMIT             Max requests per window (e.g. "10")
 *   RATE_LIMIT_WINDOW_MS   Window duration in ms (e.g. "60000")
 *
 * ── Primary defense (configure in Cloudflare dashboard) ─────────────
 *
 *   Security → WAF → Rate limiting rules → Create rule:
 *
 *     Name:      Triage API rate limit
 *     Match:     URI Path equals "/api/triage" AND Method equals "POST"
 *     Rate:      10 requests per 1 minute
 *     Counting:  Per IP
 *     Action:    Block for 60 seconds
 *
 *   The WAF rule runs at the Cloudflare edge BEFORE this Worker executes,
 *   so the two layers never conflict — they stack. A request must pass BOTH
 *   checks. If the WAF blocks a request, this code never runs at all.
 *
 * ── Why this fallback exists ────────────────────────────────────────
 *
 *   Cloudflare Workers are stateless isolates that don't share memory, so
 *   this in-memory approach is "leaky" — it won't catch all abuse across
 *   isolates. But it does catch:
 *
 *   - Accidental rapid-fire submissions (double-clicks, client bugs)
 *   - Bursts within a single isolate's lifetime
 *   - Local development (where the WAF rule doesn't apply)
 */

function parseRequiredInt(name: string): number {
  const raw = env[name];
  if (!raw) throw new Error(`Missing required environment variable: ${name}`);
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) throw new Error(`Invalid integer for ${name}: "${raw}"`);
  return parsed;
}

let limiter: RateLimiter | null = null;

function getLimiter(): RateLimiter {
  if (!limiter) {
    limiter = createRateLimiter({
      limit: parseRequiredInt("RATE_LIMIT"),
      windowMs: parseRequiredInt("RATE_LIMIT_WINDOW_MS"),
    });
  }
  return limiter;
}

/**
 * Validates the Origin header on protected POST endpoints.
 *
 * Browsers always send an Origin header on POST requests, so its absence
 * indicates a non-browser client (curl, scripts). Rejecting mismatched or
 * missing Origins prevents cross-origin abuse of our proxied API endpoints.
 */
export function isOriginAllowed(requestOrigin: string | null, canonicalOrigin: string): boolean {
  if (!requestOrigin) return false;

  // Exact match against the canonical origin (derived from Host header)
  if (requestOrigin === canonicalOrigin) return true;

  // Optional override for custom domains / preview deploys
  const allowedOverride = env.ALLOWED_ORIGIN;
  if (allowedOverride && requestOrigin === allowedOverride) return true;

  // In dev mode, allow any localhost origin (different ports for Vite, Storybook, etc.)
  if (dev) {
    try {
      const url = new URL(requestOrigin);
      return url.hostname === "localhost" || url.hostname === "127.0.0.1";
    } catch {
      return false;
    }
  }

  return false;
}

export const handle: Handle = async ({ event, resolve }) => {
  const protectedPaths = ["/api/triage", "/api/transcribe/session"];
  if (protectedPaths.includes(event.url.pathname) && event.request.method === "POST") {
    // ── Origin validation (CSRF protection) ──────────────────────────
    const requestOrigin = event.request.headers.get("origin");
    if (!isOriginAllowed(requestOrigin, event.url.origin)) {
      return json({ error: "Forbidden: invalid origin." }, { status: 403 });
    }

    // ── Rate limiting ────────────────────────────────────────────────
    let ip: string;
    try {
      ip = event.getClientAddress();
    } catch (err) {
      console.warn("[hooks] getClientAddress() failed — rate limiting bypassed:", err);
      return resolve(event);
    }

    const result = getLimiter().check(ip);

    if (!result.allowed) {
      const retryAfterSec = Math.ceil((result.retryAfterMs ?? 60_000) / 1000);
      return json(
        { error: "Too many requests. Please try again in a minute." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        },
      );
    }
  }

  return resolve(event);
};
