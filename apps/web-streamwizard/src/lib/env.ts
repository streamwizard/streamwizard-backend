import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

// Derive NEXT_PUBLIC_ vars from their non-prefixed Doppler counterparts so they
// exist in process.env before createEnv validates them. The next.config.ts env:
// block does the same derivation to bake them into the client bundle at build time.
//
// Assigned through this helper because `process.env.X = undefined` stores the
// *string* "undefined" -- a truthy value that then fails anything parsing it as
// a URL (see the images.remotePatterns block in next.config.ts).
function deriveEnv(key: string, ...sources: (string | undefined)[]) {
  const value = sources.find((v) => v !== undefined && v !== "");
  if (value !== undefined) process.env[key] = value;
}

deriveEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL);
deriveEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, process.env.SUPABASE_PUBLIC_KEY);
deriveEnv("NEXT_PUBLIC_WS_SERVER_URL", process.env.NEXT_PUBLIC_WS_SERVER_URL, process.env.WS_SERVER_URL);
deriveEnv("NEXT_PUBLIC_SENTRY_DSN", process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.SENTRY_DSN_WEB_STREAMWIZARD, process.env.SENTRY_DSN);
// User assets live in the same R2 bucket as our static CDN (under assets/),
// so the asset CDN URL falls back to NEXT_PUBLIC_CDN_URL unless overridden.
deriveEnv(
  "NEXT_PUBLIC_ASSET_CDN_URL",
  process.env.NEXT_PUBLIC_ASSET_CDN_URL,
  process.env.ASSET_CDN_URL,
  process.env.NEXT_PUBLIC_CDN_URL,
);

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
    SUPABASE_URL: z.string().url(),
    SUPABASE_PUBLIC_KEY: z.string().min(1),
    SUPABASE_SECRET_KEY: z.string().min(1),
    SUPABASE_JWT_SECRET: z.string().min(1),
    TOKEN_ENCRYPTION_KEY: z.string().min(1),
    TWITCH_CLIENT_ID: z.string().min(1),
    TWITCH_CLIENT_SECRET: z.string().min(1),
    TWITCH_WEBHOOK_SECRET: z.string().min(1),
    TWITCH_CONDUIT_ID: z.string().min(1),
    DISCORD_CLIENT_ID: z.string().min(1),
    DISCORD_CLIENT_SECRET: z.string().min(1),
    DISCORD_BOT_TOKEN: z.string().min(1),
    DISCORD_GUILD_ID: z.string().min(1),
    WS_SERVER_URL: z.string(),
    // Pushes auto-switcher config changes to ws-server /internal/broadcast
    // so the engine reacts instantly; optional — without it the engine still
    // picks changes up on its periodic re-fetch.
    CONSUMER_SECRET: z.string().min(1).optional(),
    STREAMWIZARD_API_URL: z.string().url(),
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_RELEASE: z.string().optional(),
    // Cloudflare R2 for user-uploaded overlay assets (media library). Optional
    // so environments without the feature configured still boot; the asset
    // actions throw a clear error when missing.
    R2_ACCOUNT_ID: z.string().min(1).optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    R2_ASSETS_BUCKET: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_WS_SERVER_URL: z.string(),
    NEXT_PUBLIC_BASE_URL: z.string().url(),
    NEXT_PUBLIC_OVERLAY_URL: z.string().url(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default("https://eu.i.posthog.com"),
    NEXT_PUBLIC_CDN_URL: z.string().url(),
    // Public custom domain of the R2 user-assets bucket (media library).
    // Separate from NEXT_PUBLIC_CDN_URL, which serves our own static assets.
    NEXT_PUBLIC_ASSET_CDN_URL: z.string().url().optional(),
    NEXT_PUBLIC_DOCS_URL: z.string().url().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLIC_KEY: process.env.SUPABASE_PUBLIC_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
    TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
    TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
    TWITCH_WEBHOOK_SECRET: process.env.TWITCH_WEBHOOK_SECRET,
    TWITCH_CONDUIT_ID: process.env.TWITCH_CONDUIT_ID,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
    WS_SERVER_URL: process.env.WS_SERVER_URL,
    CONSUMER_SECRET: process.env.CONSUMER_SECRET,
    STREAMWIZARD_API_URL: process.env.STREAMWIZARD_API_URL,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_RELEASE: process.env.SENTRY_RELEASE,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_ASSETS_BUCKET: process.env.R2_ASSETS_BUCKET,
    // Derived in next.config.ts env: block from their non-prefixed Doppler counterparts
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_WS_SERVER_URL: process.env.NEXT_PUBLIC_WS_SERVER_URL,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_OVERLAY_URL: process.env.NEXT_PUBLIC_OVERLAY_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
    NEXT_PUBLIC_ASSET_CDN_URL: process.env.NEXT_PUBLIC_ASSET_CDN_URL,
    NEXT_PUBLIC_DOCS_URL: process.env.NEXT_PUBLIC_DOCS_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})
