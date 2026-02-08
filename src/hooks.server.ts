import type { Handle } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";

/**
 * Soft in-memory rate limiter for /api/triage.
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

const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

/** IP → request timestamps within the current window. */
const hits = new Map<string, number[]>();

let lastCleanup = Date.now();

/** Prune stale entries every 5 minutes to prevent unbounded memory growth. */
function cleanup(now: number) {
  if (now - lastCleanup < 5 * WINDOW_MS) return;
  lastCleanup = now;
  const cutoff = now - WINDOW_MS;
  for (const [ip, timestamps] of hits) {
    const valid = timestamps.filter((t) => t > cutoff);
    if (valid.length === 0) hits.delete(ip);
    else hits.set(ip, valid);
  }
}

export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname === "/api/triage" && event.request.method === "POST") {
    const now = Date.now();
    cleanup(now);

    const ip = event.getClientAddress();
    const cutoff = now - WINDOW_MS;
    const timestamps = (hits.get(ip) ?? []).filter((t) => t > cutoff);

    if (timestamps.length >= RATE_LIMIT) {
      return json({ error: "Too many requests. Please try again in a minute." }, { status: 429 });
    }

    timestamps.push(now);
    hits.set(ip, timestamps);
  }

  return resolve(event);
};
