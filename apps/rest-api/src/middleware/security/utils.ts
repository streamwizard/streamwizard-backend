// middleware/security/utils.ts
import { Context, Next } from 'hono';
import { createHash } from 'crypto';
import { supabase } from '../../lib/supabase';

/**
 * Security Event Metadata Interface
 */
export interface SecurityEventMetadata {
  ip?: string;
  api_key_id?: string;
  client_ip?: string;
  allowed_ips?: string[];
  origin?: string;
  allowed_origins?: string[];
  attempts?: number;
  blocked_until?: string;
  endpoint?: string;
  request_id?: string;
  error_message?: string;
  [key: string]: any;
}

/**
 * Log Security Event
 * 
 * Logs security events to the audit_logs table for monitoring and compliance.
 * Handles errors gracefully to prevent logging failures from breaking the application.
 */
export async function logSecurityEvent(
  eventType: string, 
  metadata: SecurityEventMetadata
): Promise<void> {
  try {
    await supabase.from("audit_logs").insert({
      event_type: eventType,
      user_id: null, // Security events are system-level
      metadata: metadata as any,
      ip_address: metadata.ip || metadata.client_ip,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    // Don't let logging errors break the application
    console.error('Failed to log security event:', error);
  }
}

/**
 * Request ID Middleware
 * 
 * Generates a unique request ID for each request to aid in debugging and tracing.
 */
export function requestId() {
  return async (c: Context, next: Next) => {
    const reqId = createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 16);

    c.set('requestId', reqId);
    c.header('X-Request-ID', reqId);

    await next();
  };
}

/**
 * Safe Error Handler Middleware
 * 
 * Provides secure error handling that doesn't leak sensitive information
 * in production while providing detailed error information in development.
 */
export function safeErrorHandler() {
  return async (c: Context, next: Next) => {
    try {
      await next();
    } catch (error: any) {
      const requestId = c.get('requestId') || 'unknown';
      const isDevelopment = process.env.NODE_ENV === 'development';

      // Log the full error internally
      console.error('API Error:', {
        requestId,
        error: error.message,
        stack: error.stack,
        path: c.req.path,
        method: c.req.method
      });

      // Log to audit logs
      await logSecurityEvent('api_error', {
        request_id: requestId,
        error_message: error.message,
        endpoint: c.req.path,
        method: c.req.method
      });

      // Return safe error to client
      return c.json({
        error: 'Internal server error',
        message: isDevelopment 
          ? error.message // Show details in dev
          : 'An unexpected error occurred. Please try again later.',
        requestId // Always include for support
      }, 500);
    }
  };
}
