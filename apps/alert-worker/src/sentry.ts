import * as Sentry from "@sentry/bun";
import { getSentryOptions, createSupabaseIntegration, createConsoleLogsIntegration } from "@repo/sentry";

// Preloaded via `bun --preload ./src/sentry.ts` so the SDK is initialized
// before the engine loads. Shared code (@repo/alerting) reports through
// @sentry/core, which routes to this client.
// Staging and production share one Doppler config, so the DSN is namespaced
// per app; the bare SENTRY_DSN fallback keeps the per-app dev configs working.
const dsn = process.env.SENTRY_DSN_ALERT_WORKER || process.env.SENTRY_DSN;

if (dsn && process.env.NODE_ENV !== "development") {
  Sentry.init({
    ...getSentryOptions({ dsn, service: "alert-worker" }),
    integrations: [createSupabaseIntegration(Sentry), createConsoleLogsIntegration()],
  });
  console.log("[sentry] active");
}

export { Sentry };
