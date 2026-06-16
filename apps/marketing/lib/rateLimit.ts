// In-process per-key token-bucket rate limiter.
//
// Vercel Fluid Compute reuses function instances, so this module-level Map
// survives across invocations on a warm instance — good enough as a per-
// instance cost / DoS ceiling for our public POST routes without standing up
// Redis. Across N warm instances the effective limit becomes up to N × the
// configured `limit`; that's an accepted trade-off for this first pass.
//
// Callers on unauthenticated public routes (the marketing site is entirely
// public) should key by `${route}:${ip}` using a trusted forwarded-for source
// — never by user-controlled body fields — so a single client can't trivially
// rotate keys to bypass the limit.
//
// Token-bucket semantics: a bucket starts full (`limit` tokens) and refills
// continuously at `limit / windowMs` tokens per millisecond. Each call
// consumes one token; if fewer than one token is available we deny and report
// how many seconds until one will be back.
//
// Bounded memory: a periodic opportunistic sweep evicts buckets that have
// been at full capacity (i.e. idle) for >10 minutes. No timers / intervals —
// the sweep is triggered inline at most once per minute of wall time so a
// Fluid instance can still idle cleanly between requests.

interface Bucket {
  tokens: number;
  lastRefill: number;
  // Stored so the sweeper can recompute capacity without a side table.
  capacity: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number): void {
  for (const [k, b] of buckets) {
    if (b.tokens >= b.capacity && now - b.lastRefill > 10 * 60_000) {
      buckets.delete(k);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec?: number;
}

/**
 * Consume one token from the bucket identified by `key`. Returns
 * `{ allowed: true }` when the request may proceed, or
 * `{ allowed: false, retryAfterSec }` when the caller has exhausted their
 * budget. `retryAfterSec` is rounded up to the next whole second so it can
 * be used directly as a `Retry-After` header value.
 *
 * @param key       Stable identifier for the bucket. Use `${route}:${ip}` for
 *                  public unauthenticated marketing routes.
 * @param limit     Burst capacity AND number of requests permitted per window.
 * @param windowMs  Window over which the bucket fully refills, in ms.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    sweep(now);
    lastSweep = now;
  }

  const refillPerMs = limit / windowMs;
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: limit, lastRefill: now, capacity: limit };
    buckets.set(key, b);
  } else {
    // Refill continuously based on elapsed time. Clamp at capacity so an idle
    // bucket can't accumulate more than one window's worth of burst tokens.
    const elapsed = now - b.lastRefill;
    if (elapsed > 0) {
      b.tokens = Math.min(b.capacity, b.tokens + elapsed * refillPerMs);
      b.lastRefill = now;
    }
    // If the configured limit changes between calls (e.g. tuning), keep the
    // bucket honest by raising/lowering capacity in place.
    if (b.capacity !== limit) {
      b.capacity = limit;
      if (b.tokens > limit) b.tokens = limit;
    }
  }

  if (b.tokens < 1) {
    const deficit = 1 - b.tokens;
    const retryAfterSec = Math.max(1, Math.ceil(deficit / refillPerMs / 1000));
    return { allowed: false, retryAfterSec };
  }

  b.tokens -= 1;
  return { allowed: true };
}
