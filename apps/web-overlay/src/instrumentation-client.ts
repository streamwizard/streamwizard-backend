import * as Sentry from "@sentry/nextjs";
import { getSentryOptions, createSupabaseIntegration, createConsoleLogsIntegration } from "@repo/sentry";

// Guarded on both counts: `next dev` would otherwise open a transport against
// whatever DSN is in the local Doppler config and mix developer noise into the
// deployed issue stream, and an empty DSN (the var missing from the build env)
// makes Sentry.init log a warning on every page load for no gain.
//
// No replayIntegration here, unlike web-admin and web-streamwizard: overlays
// render inside an OBS browser source that nobody watches interactively, so a
// replay is a recording of a scene with no user in it — cost without signal.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn && process.env.NODE_ENV !== "development") {
  Sentry.init({
    ...getSentryOptions({ dsn, service: "web-overlay" }),
    integrations: [createSupabaseIntegration(Sentry), createConsoleLogsIntegration()],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
