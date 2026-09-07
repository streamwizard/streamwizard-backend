import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),

  // Discord
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  // Scopes slash command registration to a single guild for instant propagation in dev.
  // Omit in staging/production to register commands globally.
  DISCORD_GUILD_ID: z.string().min(1).optional(),

  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),

  // GitHub App (ticket → issue sync)
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_APP_INSTALLATION_ID: z.string().min(1),
  GITHUB_ISSUES_REPO: z.string().min(1), // "owner/repo"

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),

  // PostHog (server-side capture; analytics silently off when unset)
  POSTHOG_KEY: z.string().min(1).optional(),
  POSTHOG_HOST: z.string().url().optional(),
});

export const env = schema.parse(process.env);
