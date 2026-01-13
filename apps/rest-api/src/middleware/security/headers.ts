// middleware/security/headers.ts
import { Context, Next } from 'hono';

/**
 * Security Headers Middleware
 * 
 * Adds standard security headers to all responses to protect against
 * common web vulnerabilities and attacks.
 */
export function securityHeaders() {
  return async (c: Context, next: Next) => {
    await next();

    // Security headers
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Don't send server version
    c.header('X-Powered-By', ''); // Remove if set by framework
    
    // Content Security Policy for API responses
    c.header('Content-Security-Policy', "default-src 'none'");
  };
}
