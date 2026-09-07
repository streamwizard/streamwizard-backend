-- Lets the bot's /setup command configure which role to grant on Discord
-- account verification, per guild, instead of hardcoding a single role ID.
ALTER TABLE "public"."discord_guild_settings"
    ADD COLUMN "verified_role_id" text;
