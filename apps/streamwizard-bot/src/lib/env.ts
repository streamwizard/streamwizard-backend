import { z } from "zod"

const schema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),

  // Twitch
  TWITCH_CLIENT_ID: z.string().min(1),
  TWITCH_CLIENT_SECRET: z.string().min(1),
  TWITCH_WEBHOOK_SECRET: z.string().min(1),
  TWITCH_CONDUIT_ID: z.string().min(1),

  // Internal
  WS_SERVER_URL: z.string().url(),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),

  // Discord alerting (DMs are skipped when unset)
  DISCORD_BOT_TOKEN: z.string().min(1).optional(),
  DISCORD_ALERT_USER_ID: z.string().min(1).optional(),
})

export const env = schema.parse(process.env)
