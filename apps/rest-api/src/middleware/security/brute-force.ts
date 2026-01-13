// middleware/security/brute-force.ts
import { Context, Next } from 'hono';
import { logSecurityEvent } from './utils';

/**
 * Brute Force Protection Middleware
 * 
 * Protects against brute force attacks by tracking failed authentication attempts
 * and temporarily blocking IPs that exceed the threshold.
 */

interface BruteForceRecord {
  count: number;
  resetAt: number;
  blockedUntil?: number;
}

interface BruteForceOptions {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

// In production, use Redis instead of in-memory Map
const bruteForceStore = new Map<string, BruteForceRecord>();

// Clean up expired records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of bruteForceStore.entries()) {
    if (record.resetAt < now) {
      bruteForceStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function bruteForceProtection(options: Partial<BruteForceOptions> = {}) {
  const config: BruteForceOptions = {
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 60 * 60 * 1000, // 1 hour
    ...options
  };

  return async (c: Context, next: Next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() || 
               c.req.header('x-real-ip') || 
               c.req.header('cf-connecting-ip') || // Cloudflare
               'unknown';

    const now = Date.now();
    let record = bruteForceStore.get(ip);

    // Reset if window expired
    if (record && record.resetAt < now) {
      bruteForceStore.delete(ip);
      record = undefined;
    }

    // Check if IP is blocked
    if (record?.blockedUntil && record.blockedUntil > now) {
      const waitSeconds = Math.ceil((record.blockedUntil - now) / 1000);
      
      c.header('Retry-After', waitSeconds.toString());
      return c.json({
        error: 'Too many failed attempts',
        message: `Your IP has been temporarily blocked due to multiple failed authentication attempts. Try again in ${Math.ceil(waitSeconds / 60)} minutes.`,
        retryAfter: waitSeconds
      }, 429);
    }

    await next();

    // Track failed authentication attempts
    if (c.res.status === 401) {
      if (!record) {
        record = {
          count: 1,
          resetAt: now + config.windowMs
        };
      } else {
        record.count++;
      }

      // Block IP if threshold exceeded
      if (record.count >= config.maxAttempts) {
        record.blockedUntil = now + config.blockDurationMs;
        
        // Log security event
        logSecurityEvent('ip_blocked_brute_force', {
          ip,
          attempts: record.count,
          blocked_until: new Date(record.blockedUntil).toISOString()
        });
      }

      bruteForceStore.set(ip, record);
    } else if (c.res.status === 200) {
      // Success - clear the record
      bruteForceStore.delete(ip);
    }
  };
}
