-- Per-guild configuration for the Discord bot, starting with where to post
-- the welcome message. Managed at runtime via the bot's /setup command,
-- which is gated by Discord's native "Manage Server" permission.
CREATE TABLE IF NOT EXISTS "public"."discord_guild_settings" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL,
    "welcome_channel_id" text,
    "welcome_enabled" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_guild_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discord_guild_settings_guild_id_unique" UNIQUE ("guild_id")
);

ALTER TABLE "public"."discord_guild_settings" OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "discord_guild_settings_updated_at"
    BEFORE UPDATE ON "public"."discord_guild_settings"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE "public"."discord_guild_settings" ENABLE ROW LEVEL SECURITY;

-- Only the bot's service-role client reads/writes this table; no anon/authenticated access.
GRANT ALL ON TABLE "public"."discord_guild_settings" TO "service_role";
