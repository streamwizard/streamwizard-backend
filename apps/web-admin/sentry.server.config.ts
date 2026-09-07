import * as Sentry from "@sentry/nextjs";
import { getSentryOptions, createSupabaseIntegration, createConsoleLogsIntegration } from "@repo/sentry";

Sentry.init({
  ...getSentryOptions({ dsn: process.env.SENTRY_DSN_WEB_ADMIN || process.env.SENTRY_DSN!, service: "web-admin" }),
  integrations: [createSupabaseIntegration(Sentry), createConsoleLogsIntegration()],
});
