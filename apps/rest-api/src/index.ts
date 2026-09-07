import { Sentry } from "./sentry";
process.on("uncaughtException", (err) => { reportFatal(err, "rest-api"); });
process.on("unhandledRejection", (reason) => { Sentry.captureException(reason); });
import "./lib/env";
import { Hono } from "hono";
import { sentry } from "@sentry/hono/bun";
import { getSentryOptions, createSupabaseIntegration, createConsoleLogsIntegration, flushSentry, reportFatal } from "@repo/sentry";
import { metricsMiddleware, isMetricsEnabled } from "@repo/metrics";
import { cors } from "hono/cors";
import { securityMiddleware } from "./middleware/security";
import { rawBodyMiddleware } from "./middleware/raw-body";
import { twitchEventSubVerification } from "./middleware/twitch-eventsub";
import { githubWebhookVerification } from "./middleware/github-webhook";
import { supabaseMiddleware, supabaseAuth } from "./middleware/auth";
import { handleTwitchEventSub } from "./routes/twitch-eventsub";
import { syncClipsHandler, syncStatusHandler } from "./routes/clips-sync";
import { handleGithubWebhook } from "./handlers/github";
import nodes from "./routes/nodes";
import ingestNodes from "./routes/ingest-nodes";
import { nodeAuthCacheStats } from "./middleware/node-auth";
import { ingestNodeAuthCacheStats } from "./middleware/ingest-node-auth";

const app = new Hono();

// Liveness probe for the monitoring alert-worker — registered before every
// middleware so probe traffic never hits Sentry tracing or http_request
// metrics.
//
// The auth cache stats ride along: those caches are what keeps the node
// agents' poll loop off Supabase, so a hit rate that quietly collapses is the
// first sign the egress bill is about to come back.
app.get("/health", (c) =>
  c.json({
    ok: true,
    caches: { nodeAuth: nodeAuthCacheStats(), ingestNodeAuth: ingestNodeAuthCacheStats() },
  }),
);

// ============================================
// SECURITY MIDDLEWARE (Applied in order)
// ============================================

// Sentry must be first — sets up tracing and Hono's onError capture.
// Staging and production share one Doppler config, so the DSN is namespaced
// per app; the bare SENTRY_DSN fallback keeps the per-app dev configs working.
const sentryDsn = process.env.SENTRY_DSN_REST_API || process.env.SENTRY_DSN;

if (sentryDsn && process.env.NODE_ENV !== "development") {
  app.use("*", sentry(app, {
    ...getSentryOptions({ dsn: sentryDsn, service: "rest-api" }),
    integrations: [createSupabaseIntegration(Sentry), createConsoleLogsIntegration()],
  }));
  console.log("[sentry] active");
} else {
  console.log("[sentry] inactive (no SENTRY_DSN)");
}

app.use("*", metricsMiddleware("rest-api"));
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
app.post(
  "/webhooks/twitch/eventsub",
  rawBodyMiddleware(),
  twitchEventSubVerification(),
  handleTwitchEventSub,
);

// GitHub Webhook Handler (currently: ticket → issue sync; dispatches on event type
// in handleGithubWebhook, so future GitHub App features can share this endpoint)
app.post(
  "/webhooks/github",
  rawBodyMiddleware(),
  githubWebhookVerification(),
  handleGithubWebhook,
);

// Node claim handshake -- called by obs-instance-manager's install script
// from a fresh, untrusted VM with a one-time token, no Supabase session
// involved. Registered before the cookie/CORS-oriented "/api/*" middleware
// below so it doesn't inherit either, same as the webhook route above.
app.route("/api/nodes", nodes);

// Same rationale as above, for ingest-server's install script.
app.route("/api/ingest-nodes", ingestNodes);

// ============================================
// API ROUTES (User-facing)
// ============================================

// Enable CORS for API routes
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:3000", "https://streamwizard.org", "https://staging.streamwizard.org"], // Add your frontend URLs
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

const server = Bun.serve({
  fetch: app.fetch,
  hostname: "0.0.0.0",
  port: Number(process.env.PORT ?? 8080),
});

// Without a signal handler the container is killed outright on deploy and any
// queued Sentry event dies with it.
const shutdown = async () => {
  console.log("[rest-api] shutting down");
  server.stop();
  await flushSentry();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`[rest-api] listening on port ${process.env.PORT ?? 8080}`);
console.log(`[metrics] ${isMetricsEnabled() ? "active — sending to " + process.env.INFLUXDB_URL : "disabled — set INFLUXDB_* env vars to enable"}`);
