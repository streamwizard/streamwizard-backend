// middleware/rateLimit.ts
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