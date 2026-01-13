// middleware/security/whitelisting.ts
import { Context, Next } from 'hono';
import { logSecurityEvent } from './utils';

/**
 * IP Whitelisting Middleware
 * 
 * Restricts API access to specific IP addresses based on API key configuration.
 */
export function ipWhitelisting() {
  return async (c: Context, next: Next) => {
    const keyData = c.get('apiKey');
    
    if (!keyData) {
      await next();
      return;
    }

    const allowedIps = keyData.metadata?.allowedIps as string[] | undefined;

    // If no IP whitelist configured, allow all
    if (!allowedIps || allowedIps.length === 0) {
      await next();
      return;
    }

    const clientIp = c.req.header('x-forwarded-for')?.split(',')[0].trim() || 
                     c.req.header('x-real-ip') ||
                     c.req.header('cf-connecting-ip') ||
                     'unknown';

    // Check if IP is whitelisted
    const isAllowed = allowedIps.some(allowedIp => {
      // Support CIDR notation in the future
      return allowedIp === clientIp;
    });

    if (!isAllowed) {
      // Log unauthorized access attempt
      await logSecurityEvent('ip_not_whitelisted', {
        api_key_id: keyData.id,
        client_ip: clientIp,
        allowed_ips: allowedIps
      });

      return c.json({
        error: 'Access denied',
        message: 'Your IP address is not authorized to use this API key.'
      }, 403);
    }

    await next();
  };
}

/**
 * Origin Whitelisting Middleware (CORS)
 * 
 * Restricts API access to specific origins/domains based on API key configuration.
 * Supports wildcard subdomain matching.
 */
export function originWhitelisting() {
  return async (c: Context, next: Next) => {
    const keyData = c.get('apiKey');
    const origin = c.req.header('origin');

    if (!keyData || !origin) {
      await next();
      return;
    }

    const allowedOrigins = keyData.metadata?.allowedOrigins as string[] | undefined;

    // If no origin whitelist, allow all in test mode, block in live
    if (!allowedOrigins || allowedOrigins.length === 0) {
      if (keyData.environment === 'live') {
        return c.json({
          error: 'Origin not configured',
          message: 'Please configure allowed origins for this API key.'
        }, 403);
      }
      // Allow all origins in test mode
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Credentials', 'true');
      await next();
      return;
    }

    // Check if origin is whitelisted
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      // Exact match
      if (allowedOrigin === origin) return true;
      
      // Wildcard subdomain support: *.example.com
      if (allowedOrigin.startsWith('*.')) {
        const domain = allowedOrigin.slice(2);
        return origin.endsWith(domain);
      }
      
      return false;
    });

    if (!isAllowed) {
      await logSecurityEvent('origin_not_whitelisted', {
        api_key_id: keyData.id,
        origin,
        allowed_origins: allowedOrigins
      });

      return c.json({
        error: 'Origin not allowed',
        message: 'Your domain is not authorized to use this API key.'
      }, 403);
    }

    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
    
    await next();
  };
}
