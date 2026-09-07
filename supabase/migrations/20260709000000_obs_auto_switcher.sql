-- IRL auto scene-switcher configuration (one row per user).
-- The obs-auto-switcher engine (service_role) loads all enabled rows and
-- reacts to live config pushes routed through ws-server; the row in this
-- table stays the source of truth. Scenes are stored by obs-websocket v5
-- sceneUuid (survives renames) with the name kept for display/logging only.
-- No Supabase realtime publication on purpose: config propagation goes
-- web server action -> ws-server POST /internal/broadcast -> engine.
CREATE TABLE "public"."obs_auto_switcher_configs" (
    "user_id" uuid NOT NULL,
    "enabled" boolean NOT NULL DEFAULT false,
    "mode" text NOT NULL DEFAULT 'simple',
    "scene_model" text NOT NULL DEFAULT 'three',
    "scene_live_uuid" text,
    "scene_live_name" text,
    "scene_degraded_uuid" text,
    "scene_degraded_name" text,
    "scene_offline_uuid" text,
    "scene_offline_name" text,
    "sensitivity_preset" text NOT NULL DEFAULT 'balanced',
    "advanced_thresholds" jsonb,
    "pinned_stream_key_label" text,
    "log_events_enabled" boolean NOT NULL DEFAULT true,
    "chat_notices_enabled" boolean NOT NULL DEFAULT false,
    "chat_template_degraded" text NOT NULL DEFAULT 'Connection unstable — switching to backup scene ({bitrate} kbps, {rtt} ms RTT)',
    "chat_template_offline" text NOT NULL DEFAULT 'Stream signal lost — hang tight!',
    "chat_template_recovered" text NOT NULL DEFAULT 'Signal restored — back live!',
    "warning_source_enabled" boolean NOT NULL DEFAULT false,
    "warning_source_uuid" text,
    "warning_source_name" text,
    "auto_stop_enabled" boolean NOT NULL DEFAULT false,
    "auto_stop_minutes" integer NOT NULL DEFAULT 10,
    "override_scene_uuid" text,
    "override_scene_name" text,
    "override_expires_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "obs_auto_switcher_configs_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "obs_auto_switcher_configs_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    CONSTRAINT "obs_auto_switcher_configs_mode_check"
        CHECK ("mode" IN ('simple', 'advanced')),
    CONSTRAINT "obs_auto_switcher_configs_scene_model_check"
        CHECK ("scene_model" IN ('two', 'three')),
    CONSTRAINT "obs_auto_switcher_configs_sensitivity_preset_check"
        CHECK ("sensitivity_preset" IN ('relaxed', 'balanced', 'fast')),
    CONSTRAINT "obs_auto_switcher_configs_auto_stop_minutes_check"
        CHECK ("auto_stop_minutes" BETWEEN 1 AND 120)
);

ALTER TABLE "public"."obs_auto_switcher_configs" OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "obs_auto_switcher_configs_updated_at"
    BEFORE UPDATE ON "public"."obs_auto_switcher_configs"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- RLS: owners manage their own config; the engine uses the service-role
-- client which bypasses RLS.
ALTER TABLE "public"."obs_auto_switcher_configs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own auto switcher config" ON "public"."obs_auto_switcher_configs"
    FOR SELECT USING (((SELECT auth.uid()) = "user_id"));

CREATE POLICY "Users insert own auto switcher config" ON "public"."obs_auto_switcher_configs"
    FOR INSERT WITH CHECK (((SELECT auth.uid()) = "user_id"));

CREATE POLICY "Users update own auto switcher config" ON "public"."obs_auto_switcher_configs"
    FOR UPDATE USING (((SELECT auth.uid()) = "user_id"))
    WITH CHECK (((SELECT auth.uid()) = "user_id"));

CREATE POLICY "Users delete own auto switcher config" ON "public"."obs_auto_switcher_configs"
    FOR DELETE USING (((SELECT auth.uid()) = "user_id"));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."obs_auto_switcher_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."obs_auto_switcher_configs" TO "service_role";

-- Allow the auto-switcher to log scene switches into the existing
-- stream_events feed (event_type 'obs.scene_switch', provider 'streamwizard').
ALTER TABLE "public"."stream_events" DROP CONSTRAINT "stream_events_provider_check";
ALTER TABLE "public"."stream_events" ADD CONSTRAINT "stream_events_provider_check"
    CHECK ("provider" = ANY (ARRAY['twitch'::text, 'minecraft'::text, 'streamwizard'::text]));

COMMENT ON COLUMN "public"."stream_events"."provider" IS 'Event provider: twitch, minecraft or streamwizard';
