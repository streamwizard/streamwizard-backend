import { type Context, type Next } from "hono";

/**
 * Raw Body Middleware
 * 
 * Preserves the raw request body for webhook signature verification.
 * Stores the raw body in the context so it can be accessed multiple times.
 * 
 * This is necessary for Twitch EventSub webhooks which require
 * the raw body for HMAC signature verification.
 */
export function rawBodyMiddleware() {
  return async (c: Context, next: Next) => {
    // Only process POST requests (webhooks are typically POST)
    if (c.req.method === "POST") {
      // Clone the request to avoid consuming the body
      const clonedRequest = c.req.raw.clone();
      const rawBody = await clonedRequest.text();
      
      // Store raw body in context for later use
      c.set("rawBody", rawBody);
    }
    
    await next();
  };
}

