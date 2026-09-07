/**
 * Per-API-key rate limiting: 1000 requests/hour by default, or whatever
 * `rate_limit` the key's row carries. Answers with 429 and the standard
 * X-RateLimit-* headers once a key is over its window.
 *
 * NOT WIRED UP YET. Nothing calls rateLimit(), so no route is currently
 * limited — the securityMiddleware chain in src/index.ts covers request ids,
 * HTTPS, headers and brute-force, but not this. To turn it on, mount it after
 * the auth middleware that populates `c.get("apiKey")`:
 *
 *   app.use("*", rateLimit());
 *
 * Two things to settle before that ships:
 *   - the store is per-process and in-memory, so N instances mean N x limit.
 *     Redis (or the ingest rate-limit table) is the fix for a real deployment.
 *   - `apiKey` is only set on routes that authenticate with one; requests
 *     without a key fall straight through, by design.
 */
import { type Context, type Next } from 'hono';

interface RateLimitStore {
  requests: number;
  resetAt: number;
}

// In-memory store (use Redis in production for distributed systems)
const rateLimitStore = new Map<string, RateLimitStore>();

export function rateLimit() {
  return async (c: Context, next: Next) => {
    const keyData = c.get('apiKey');
    
    if (!keyData) {
      await next();
      return;
    }

    const keyId = keyData.id;
    const limit = keyData.rate_limit || 1000; // per hour
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour

    let record = rateLimitStore.get(keyId);

    // Reset if window expired
    if (!record || record.resetAt < now) {
      record = {
        requests: 0,
        resetAt: now + windowMs
      };
    }

    record.requests++;
    rateLimitStore.set(keyId, record);

    // Set rate limit headers
    c.header('X-RateLimit-Limit', limit.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, limit - record.requests).toString());
    c.header('X-RateLimit-Reset', new Date(record.resetAt).toISOString());

    if (record.requests > limit) {
      return c.json({
        error: 'Rate limit exceeded',
        retryAfter: new Date(record.resetAt).toISOString()
      }, 429);
    }

    await next();
  };
}

// Cleanup expired records periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of Array.from(rateLimitStore.entries())) {
    if (record.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes