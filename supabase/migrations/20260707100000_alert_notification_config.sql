-- Notification routing for the alert engine, editable from /alerts/notifications.
-- One row per environment; a missing row (or NULL column) falls back to the
-- code defaults in notify.ts and the ALERT_DISCORD_CHANNEL_ID /
-- TELEGRAM_CHAT_ID env vars. Bot TOKENS deliberately stay in Doppler — this
-- table holds addresses and policy, never secrets.
--
-- Severity semantics: 'off' = never send, 'warn' = warn and crit, 'crit' =
-- crit only. Resolved messages follow the route the alert fired on.
CREATE TABLE "public"."alert_notification_config" (
    "env" text NOT NULL,
    "discord_channel_id" text,
    "discord_severity" text NOT NULL DEFAULT 'warn',
    "telegram_chat_id" text,
    "telegram_severity" text NOT NULL DEFAULT 'off',
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "updated_by" uuid,
    CONSTRAINT "alert_notification_config_pkey" PRIMARY KEY ("env"),
    CONSTRAINT "alert_notification_config_env_check" CHECK ("env" IN ('prod', 'staging', 'dev')),
    CONSTRAINT "alert_notification_config_discord_severity_check"
        CHECK ("discord_severity" IN ('off', 'warn', 'crit')),
    CONSTRAINT "alert_notification_config_telegram_severity_check"
        CHECK ("telegram_severity" IN ('off', 'warn', 'crit'))
);

ALTER TABLE "public"."alert_notification_config" OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "alert_notification_config_updated_at"
    BEFORE UPDATE ON "public"."alert_notification_config"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE "public"."alert_notification_config" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read alert notification config" ON "public"."alert_notification_config"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.check_user_role('admin') ) );

GRANT ALL ON TABLE "public"."alert_notification_config" TO "service_role";
GRANT SELECT ON TABLE "public"."alert_notification_config" TO "authenticated";
