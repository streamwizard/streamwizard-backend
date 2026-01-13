// middleware/security/audit.ts
import { Context, Next } from "hono";
import { logSecurityEvent } from "./utils";
import { supabase } from "../../lib/supabase";

/**
 * Audit Logging Middleware
 *
 * Tracks API key usage and logs security events for monitoring and compliance.
 */
export function auditApiKeyUsage() {
  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const keyData = c.get("apiKey");

    await next();

    if (!keyData) return;

    const duration = Date.now() - startTime;
    const ip = c.req.header("x-forwarded-for")?.split(",")[0].trim() || c.req.header("x-real-ip") || "unknown";

    // Log every request (or batch them for performance)
    // In production, consider sampling or batching
    const shouldLog =
      c.res.status >= 400 || // Always log errors
      Math.random() < 0.1; // Sample 10% of successful requests

    if (shouldLog) {
      logSecurityEvent("api_key_usage", {
        api_key_id: keyData.id,
        tenant_id: keyData.tenant_id,
        endpoint: c.req.path,
        method: c.req.method,
        status_code: c.res.status,
        duration_ms: duration,
        ip,
        user_agent: c.req.header("user-agent"),
        environment: keyData.environment,
      });
    }

    // Update last_used_at (async, don't wait)
    if (c.res.status < 400) {
      supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyData.id).then(); // Fire and forget
    }
  };
}
