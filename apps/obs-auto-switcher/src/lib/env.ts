import { z } from "zod"

const schema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),

  // Supabase (service role — config reads, obs_instances/obs_nodes lookups,
  // stream_events inserts)
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),

  // ws-server: consumer feed in (ingest stats + config pushes), bot feed out
  // (status messages to user rooms)
  WS_SERVER_URL: z.string().url(),
  CONSUMER_SECRET: z.string().min(1),

  // Decrypts each node's per-node obs_command key (from obs_node_api_keys)
  // before calling the node's /obs route. Must match the key the rest-api /
  // nodes encrypt with.
  TOKEN_ENCRYPTION_KEY: z.string().min(1),

  // Twitch app credentials for chat notices (@repo/twitch-api app token path)
  TWITCH_CLIENT_ID: z.string().min(1),
  TWITCH_CLIENT_SECRET: z.string().min(1),

  // How often the in-memory config is reloaded wholesale from Supabase. This
  // poll is only the safety net for a dropped consumer-feed push — a config
  // change that lands normally applies in ~1s — so it is tuned for egress, not
  // latency. See the comment on RECONCILE_INTERVAL_MS in config-store.ts.
  CONFIG_RECONCILE_INTERVAL_MS: z.coerce.number().int().positive().default(300_000),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),
})

export const env = schema.parse(process.env)
