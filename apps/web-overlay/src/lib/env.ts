import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

// Derive NEXT_PUBLIC_ vars from their non-prefixed Doppler counterparts so they
// exist in process.env before createEnv validates them. The next.config.ts env:
// block does the same derivation to bake them into the client bundle at build time.
//
// Assigned through this helper because `process.env.X = undefined` stores the
// *string* "undefined" -- a truthy non-URL value that fails validation even for
// optional vars (dev configs set no SENTRY_DSN). Leave those unset instead.
function deriveEnv(key: string, ...sources: (string | undefined)[]) {
  const value = sources.find((v) => v !== undefined && v !== "");
  if (value !== undefined) process.env[key] = value;
}

deriveEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL);
deriveEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, process.env.SUPABASE_PUBLIC_KEY);
deriveEnv("NEXT_PUBLIC_WS_SERVER_URL", process.env.NEXT_PUBLIC_WS_SERVER_URL, process.env.WS_SERVER_URL);
deriveEnv("NEXT_PUBLIC_SENTRY_DSN", process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.SENTRY_DSN_WEB_OVERLAY, process.env.SENTRY_DSN);
// User media-library assets share the static-CDN bucket; falls back to the CDN URL.
deriveEnv(
  "NEXT_PUBLIC_ASSET_CDN_URL",
  process.env.NEXT_PUBLIC_ASSET_CDN_URL,
  process.env.ASSET_CDN_URL,
  process.env.NEXT_PUBLIC_CDN_URL,
);

export const env = createEnv({
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
  server: {
    NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
    SUPABASE_URL: z.string().url(),
    SUPABASE_PUBLIC_KEY: z.string().min(1),
    SUPABASE_SECRET_KEY: z.string().min(1),
    TOKEN_ENCRYPTION_KEY: z.string().min(1),
    TWITCH_CLIENT_ID: z.string().min(1),
    TWITCH_CLIENT_SECRET: z.string().min(1),
    WS_SERVER_URL: z.string(),
    // Authorizes POSTs to ws-server /internal/broadcast (user-state pushes).
    // Optional: without it state mutations still land in the DB, they just
    // don't reach open overlays until the widget's next read.
    CONSUMER_SECRET: z.string().optional(),
    STREAMWIZARD_API_URL: z.string().url(),
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_RELEASE: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_WS_SERVER_URL: z.string(),
    NEXT_PUBLIC_BASE_URL: z.string().url(),
    NEXT_PUBLIC_OVERLAY_URL: z.string().url(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    NEXT_PUBLIC_ASSET_CDN_URL: z.string().url().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLIC_KEY: process.env.SUPABASE_PUBLIC_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
    TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
    TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
    WS_SERVER_URL: process.env.WS_SERVER_URL,
    CONSUMER_SECRET: process.env.CONSUMER_SECRET,
    STREAMWIZARD_API_URL: process.env.STREAMWIZARD_API_URL,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_RELEASE: process.env.SENTRY_RELEASE,
    // Derived in next.config.ts env: block from their non-prefixed Doppler counterparts
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_WS_SERVER_URL: process.env.NEXT_PUBLIC_WS_SERVER_URL,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_OVERLAY_URL: process.env.NEXT_PUBLIC_OVERLAY_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_ASSET_CDN_URL: process.env.NEXT_PUBLIC_ASSET_CDN_URL,
  },
})
