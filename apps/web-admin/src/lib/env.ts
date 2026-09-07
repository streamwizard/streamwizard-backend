import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Derive NEXT_PUBLIC_ vars from their non-prefixed Doppler counterparts.
// next.config.ts does the same to bake them into the client bundle at build time.
// Assigning undefined to process.env stores the *string* "undefined", which then
// fails validation even for optional vars (stg sets no SENTRY_DSN) — leave unset.
function derive(key: string, value: string | undefined): void {
  if (value !== undefined) process.env[key] = value;
}

derive("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL);
derive("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLIC_KEY);
derive("NEXT_PUBLIC_SENTRY_DSN", process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN_WEB_ADMIN ?? process.env.SENTRY_DSN);

export const env = createEnv({
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
  server: {
    INFLUXDB_URL: z.string().url(),
    INFLUXDB_TOKEN: z.string().min(1),
    INFLUXDB_ORG: z.string().min(1),
    INFLUXDB_BUCKET: z.string().min(1),
    NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
    MONITOR_SECRET: z.string().min(1).optional(),
    SUPABASE_URL: z.string().url(),
    SUPABASE_PUBLIC_KEY: z.string().min(1),
    SUPABASE_SECRET_KEY: z.string().min(1),
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_RELEASE: z.string().optional(),
    // Alert routing/display — the engine itself runs in apps/alert-worker; the
    // /alerts UI still reads these for notification defaults and test sends.
    // Next standalone overwrites NODE_ENV=production at startup, so non-prod
    // deployments must state their env explicitly for alert routing.
    ALERT_ENV: z.enum(["prod", "staging", "dev"]).optional(),
    ALERT_DISCORD_CHANNEL_ID: z.string().min(1).optional(),
    DISCORD_BOT_TOKEN: z.string().min(1).optional(),
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    TELEGRAM_CHAT_ID: z.string().min(1).optional(),
    // Same var the rest of the stack uses for the rest-api base URL; the
    // ws-server probe derives from NEXT_PUBLIC_WS_SERVER_URL. Node install
    // commands on /obs and /ingest embed it, so it must be set.
    STREAMWIZARD_API_URL: z.string().url(),
    // Encrypts OBS WS passwords written to obs_instances; must be byte-identical
    // to web-streamwizard's key or its user-facing pages can't decrypt them.
    TOKEN_ENCRYPTION_KEY: z.string().min(1),
    // Auto-switcher config pushes ride ws-server's /internal/broadcast; both
    // optional — without them saves still land in the DB and the engine's 60s
    // reconcile picks them up.
    WS_SERVER_URL: z.string().min(1).optional(),
    CONSUMER_SECRET: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_WS_SERVER_URL: z.string().min(1).optional(),
    NEXT_PUBLIC_MONITOR_SECRET: z.string().min(1).optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  },
  runtimeEnv: {
    INFLUXDB_URL: process.env.INFLUXDB_URL,
    INFLUXDB_TOKEN: process.env.INFLUXDB_TOKEN,
    INFLUXDB_ORG: process.env.INFLUXDB_ORG,
    INFLUXDB_BUCKET: process.env.INFLUXDB_BUCKET,
    NODE_ENV: process.env.NODE_ENV,
    MONITOR_SECRET: process.env.MONITOR_SECRET,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLIC_KEY: process.env.SUPABASE_PUBLIC_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_RELEASE: process.env.SENTRY_RELEASE,
    ALERT_ENV: process.env.ALERT_ENV,
    ALERT_DISCORD_CHANNEL_ID: process.env.ALERT_DISCORD_CHANNEL_ID,
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    STREAMWIZARD_API_URL: process.env.STREAMWIZARD_API_URL,
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
    WS_SERVER_URL: process.env.WS_SERVER_URL,
    CONSUMER_SECRET: process.env.CONSUMER_SECRET,
    NEXT_PUBLIC_WS_SERVER_URL: process.env.NEXT_PUBLIC_WS_SERVER_URL,
    NEXT_PUBLIC_MONITOR_SECRET: process.env.NEXT_PUBLIC_MONITOR_SECRET,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
});
