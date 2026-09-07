import * as Sentry from "@sentry/nextjs";
import { getSentryOptions, createSupabaseIntegration, createConsoleLogsIntegration } from "@repo/sentry";

// Guarded on both counts: `next dev` would otherwise open a transport against
// whatever DSN is in the local Doppler config and mix developer noise into the
// deployed issue stream, and an empty DSN (the var missing from the build env)
// makes Sentry.init log a warning on every page load for no gain.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn && process.env.NODE_ENV !== "development") {
  Sentry.init({
    ...getSentryOptions({ dsn, service: "web-admin" }),
    integrations: [
      Sentry.replayIntegration(),
      createSupabaseIntegration(Sentry),
      createConsoleLogsIntegration(),
    ],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
