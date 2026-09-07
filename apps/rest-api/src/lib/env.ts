import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLIC_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),

  // Twitch
  TWITCH_CLIENT_ID: z.string().min(1),
  TWITCH_CLIENT_SECRET: z.string().min(1),
  TWITCH_WEBHOOK_SECRET: z.string().min(1),

  // GitHub (ticket → issue sync webhook)
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  GITHUB_ISSUES_REPO: z.string().min(1), // "owner/repo"
  DISCORD_BOT_TOKEN: z.string().min(1),

  // Public URL returned to nodes during /claim so they know where to send requests
  STREAMWIZARD_API_URL: z.string().url(),

  // S3 BUCKET OBS
  OBS_S3_ACCESS_KEY: z.string().min(1),
  OBS_S3_BUCKET: z.string().min(1),
  OBS_S3_ENDPOINT: z.url(),
  OBS_S3_REGION: z.string().min(1),
  OBS_S3_SECRET_KEY: z.string().min(1),

  // Tailscale OAuth client, scoped to auth_keys + tag:ingest-node only.
  // Used during /api/ingest-nodes/claim to mint a fresh, single-use, tagged
  // auth key per node instead of requiring an admin to paste one in by hand.
  TAILSCALE_OAUTH_CLIENT_ID: z.string().min(1),
  TAILSCALE_OAUTH_CLIENT_SECRET: z.string().min(1),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),

  // InfluxDB — relayed to ingest/OBS nodes in the /claim response so they can
  // report host + instance metrics without a separate manual .env edit per
  // node. Optional: a claim still succeeds without these, it just omits them
  // from the response (see ingest-nodes.ts / nodes.ts), same as install.sh
  // already tolerates a missing tailscale_authkey.
  INFLUXDB_URL: z.string().url().optional(),
  INFLUXDB_ORG: z.string().optional(),
  INFLUXDB_BUCKET: z.string().optional(),
  INFLUXDB_TOKEN: z.string().optional(),

  // ws-server broadcast — relayed to OBS nodes in the /claim response so the
  // obs-instance-manager can push container lifecycle events to the owning
  // user's browser room. Optional and paired: a claim omits both from the
  // response unless both are set. CONSUMER_SECRET must match the ws-server's.
  WS_SERVER_URL: z.string().optional(),
  CONSUMER_SECRET: z.string().optional(),
});

export const env = schema.parse(process.env);
