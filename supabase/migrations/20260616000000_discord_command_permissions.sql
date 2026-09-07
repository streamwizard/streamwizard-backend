-- Per-guild, per-command role allowlist for the Discord bot.
-- A command with no rows for a guild is open to everyone in that guild.
-- A command with rows is restricted to members holding at least one of the
-- mapped roles. Managed at runtime via the bot's /permissions command,
-- which itself is gated by Discord's native "Manage Server" permission.
CREATE TABLE IF NOT EXISTS "public"."discord_command_permissions" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL,
    "command_name" text NOT NULL,
    "role_id" text NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_command_permissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discord_command_permissions_unique" UNIQUE ("guild_id", "command_name", "role_id")
);

ALTER TABLE "public"."discord_command_permissions" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "discord_command_permissions_guild_command_idx"
    ON "public"."discord_command_permissions" USING btree ("guild_id", "command_name");

ALTER TABLE "public"."discord_command_permissions" ENABLE ROW LEVEL SECURITY;

-- Only the bot's service-role client reads/writes this table; no anon/authenticated access.
GRANT ALL ON TABLE "public"."discord_command_permissions" TO "service_role";
