import { Hono } from "hono";
import { cors } from "hono/cors";
import { securityMiddleware } from "./middleware/security";
import { rawBodyMiddleware } from "./middleware/raw-body";
import { twitchEventSubVerification } from "./middleware/twitch-eventsub";
import { supabaseMiddleware, supabaseAuth } from "./middleware/auth";
import { handleTwitchEventSub } from "./routes/twitch-eventsub";
import { syncClipsHandler, syncStatusHandler } from "./routes/clips-sync";

const app = new Hono();

// ============================================
// SECURITY MIDDLEWARE (Applied in order)
// ============================================

app.use("*", securityMiddleware.requestId());

// 2. HTTPS enforcement (production only)
app.use("*", securityMiddleware.enforceHttps());

// 3. Security headers
app.use("*", securityMiddleware.securityHeaders());

// 6. Brute force protection (after auth, before routes)
app.use("*", securityMiddleware.bruteForceProtection());

// 10. Audit logging
// app.use("*", securityMiddleware.auditApiKeyUsage());

// 11. Safe error handler (should be last)
app.use("*", securityMiddleware.safeErrorHandler());

// ============================================
// ROUTES
// ============================================

app.get("/", (c) => {
  return c.json({ message: "StreamWizard API", version: "1.0.0" });
});

// Twitch EventSub Webhook Handler
// This endpoint receives webhook callbacks from Twitch EventSub
// Raw body middleware preserves the body for signature verification
// Verification middleware validates headers and HMAC signature
app.post(
  "/webhooks/twitch/eventsub",
  rawBodyMiddleware(),
  twitchEventSubVerification(),
  handleTwitchEventSub,
);

// ============================================
// API ROUTES (User-facing)
// ============================================

// Enable CORS for API routes
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:3000", "https://streamwizard.org"], // Add your frontend URLs
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// Apply Supabase middleware to all API routes
app.use("/api/*", supabaseMiddleware());

// Clips Sync - Trigger a sync for authenticated user
app.post("/api/clips/sync", supabaseAuth(), syncClipsHandler);

// Clips Sync Status - Get sync status for authenticated user
app.get("/api/clips/sync-status", supabaseAuth(), syncStatusHandler);

Bun.serve({
  fetch: app.fetch,
  port: 8000,
});

console.log(`Server is running on port ${8000}`);
