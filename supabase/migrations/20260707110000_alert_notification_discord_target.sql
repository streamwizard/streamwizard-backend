-- Discord alerts can go to a channel or directly to a user's DMs.
-- 'channel' → discord_channel_id is a channel ID (POST /channels/:id/messages)
-- 'dm'      → discord_channel_id is a USER ID (bot opens a DM channel first)
ALTER TABLE "public"."alert_notification_config"
    ADD COLUMN "discord_target" text NOT NULL DEFAULT 'channel';

ALTER TABLE "public"."alert_notification_config"
    ADD CONSTRAINT "alert_notification_config_discord_target_check"
    CHECK ("discord_target" IN ('channel', 'dm'));
