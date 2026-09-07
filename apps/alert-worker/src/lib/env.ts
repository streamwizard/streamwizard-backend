import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),

  // Which environment this deployment monitors; falls back to NODE_ENV
  // mapping inside @repo/alerting's homeEnv().
  ALERT_ENV: z.enum(["prod", "staging", "dev"]).optional(),

  // Alert state, history, and rule/notification config
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),

  // Metrics source for the rule queries
  INFLUXDB_URL: z.string().url(),
  INFLUXDB_TOKEN: z.string().min(1),
  INFLUXDB_ORG: z.string().min(1),
  INFLUXDB_BUCKET: z.string().min(1),

  // Notification channels — optional so a dev alert-worker (alert_events only)
  // boots without them.
  ALERT_DISCORD_CHANNEL_ID: z.string().min(1).optional(),
  DISCORD_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_CHAT_ID: z.string().min(1).optional(),

  // Probe targets: rest-api /health and the ws-server health endpoint
  // (derived from the websocket URL).
  STREAMWIZARD_API_URL: z.string().url().optional(),
  WS_SERVER_URL: z.string().min(1).optional(),

  // Dashboard URL for the "Open dashboard" button on Discord alerts.
  MONITOR_BASE_URL: z.string().url().optional(),

  // Dead-man's switch: pinged after every tick, /fail on errors.
  // Compose's `${HEALTHCHECKS_PING_URL:-}` default injects an empty string when
  // unset, which `.url()` rejects; treat "" as "disabled" (matches the falsy
  // guard at the ping site) rather than a validation error.
  HEALTHCHECKS_PING_URL: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional()),
  // NOTE: forTicks debounces are counted in ticks, not seconds — raising this
  // slows every rule's fire latency proportionally (the startup log prints
  // the derived per-rule latencies). Production/staging set 60 via Doppler.
  TICK_SECONDS: z.coerce.number().int().positive().default(15),

  // Escape hatch for the tick overlap lock (folded into the snapshot RPC, so
  // it costs no extra requests). Anything but the literal "false" leaves it
  // on. Read lazily by @repo/alerting's config, declared here for visibility.
  ALERT_LOCK_ENABLED: z.enum(["true", "false"]).optional(),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),
});

export const env = schema.parse(process.env);
