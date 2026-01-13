// middleware/security/https.ts
import { Context, Next } from 'hono';
import { env } from '../../lib/env';

/**
 * HTTPS Enforcement Middleware
 * 
 * Enforces HTTPS connections in production environments.
 * Adds HSTS headers for additional security.
 */
export function enforceHttps() {
  return async (c: Context, next: Next) => {
    // Skip in development
    if (env.NODE_ENV === 'development') {
      await next();
      return;
    }

    const proto = c.req.header('x-forwarded-proto') || 
                  c.req.header('x-forwarded-protocol') ||
                  'http';

    if (proto !== 'https') {
      return c.json({
        error: 'HTTPS required',
        message: 'This API requires a secure connection. Please use HTTPS.'
      }, 403);
    }

    // Add security headers
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    
    await next();
  };
}
