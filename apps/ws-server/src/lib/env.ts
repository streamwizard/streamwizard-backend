import { z } from "zod"

const schema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.coerce.number().default(8000),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),

  // Monitor (optional — live WS inspector)
  MONITOR_SECRET: z.string().min(1).optional(),

  // Trusted server-to-server consumers (optional — obs-auto-switcher).
  // Gates both the `role=consumer` WS upgrade and POST /internal/broadcast.
  CONSUMER_SECRET: z.string().min(1).optional(),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),
})

export const env = schema.parse(process.env)
