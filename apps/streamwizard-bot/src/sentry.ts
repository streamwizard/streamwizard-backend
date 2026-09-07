import * as Sentry from "@sentry/bun";
import { getSentryOptions, createSupabaseIntegration, createConsoleLogsIntegration } from "@repo/sentry";

// Staging and production share one Doppler config, so the DSN is namespaced
// per app; the bare SENTRY_DSN fallback keeps the per-app dev configs working.
const dsn = process.env.SENTRY_DSN_STREAMWIZARD_BOT || process.env.SENTRY_DSN;

if (dsn && process.env.NODE_ENV !== "development") {
  Sentry.init({
    ...getSentryOptions({ dsn, service: "streamwizard-bot" }),
    integrations: [createSupabaseIntegration(Sentry), createConsoleLogsIntegration()],
  });
  console.log("[sentry] active");
} else {
  console.log("[sentry] inactive (no SENTRY_DSN)");
}

export { Sentry };
