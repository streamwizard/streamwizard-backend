-- Alerting state for the web-admin alert engine (monitoring plan v2.2).
-- The engine (service_role) evaluates ~29 rules per environment every 60s:
-- alert_state holds the current status per rule x env x entity (dedup,
-- consecutive-breach counting, 30m crit renotify cooldown, silencing),
-- alert_events is the append-only history that powers the Alerts UI, and
-- alert_locks is the overlap guard so two evaluate ticks never run
-- concurrently. Alert state deliberately lives in Supabase rather than in
-- process so dedup/cooldown/history survive web-admin deploys.
CREATE TABLE "public"."alert_state" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "rule_id" text NOT NULL,
    "env" text NOT NULL,
    "entity_id" text NOT NULL DEFAULT '',
    "status" text NOT NULL DEFAULT 'ok',
    "severity" text,
    "consecutive_breaches" integer NOT NULL DEFAULT 0,
    "first_fired_at" timestamptz,
    "last_notified_at" timestamptz,
    "silenced_until" timestamptz,
    "notify_failed" boolean NOT NULL DEFAULT false,
    "last_value" double precision,
    "message" text,
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "alert_state_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "alert_state_rule_env_entity_key" UNIQUE ("rule_id", "env", "entity_id"),
    CONSTRAINT "alert_state_env_check" CHECK ("env" IN ('prod', 'staging', 'dev')),
    CONSTRAINT "alert_state_status_check" CHECK ("status" IN ('ok', 'firing')),
    CONSTRAINT "alert_state_severity_check" CHECK ("severity" IS NULL OR "severity" IN ('warn', 'crit'))
);

ALTER TABLE "public"."alert_state" OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "alert_state_updated_at"
    BEFORE UPDATE ON "public"."alert_state"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE TABLE "public"."alert_events" (
    "id" bigint GENERATED ALWAYS AS IDENTITY,
    "rule_id" text NOT NULL,
    "env" text NOT NULL,
    "entity_id" text NOT NULL DEFAULT '',
    "event_type" text NOT NULL,
    "severity" text,
    "value" double precision,
    "message" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "alert_events_env_check" CHECK ("env" IN ('prod', 'staging', 'dev')),
    CONSTRAINT "alert_events_event_type_check"
        CHECK ("event_type" IN ('fired', 'resolved', 'renotified', 'notify_failed', 'silenced')),
    CONSTRAINT "alert_events_severity_check" CHECK ("severity" IS NULL OR "severity" IN ('warn', 'crit'))
);

ALTER TABLE "public"."alert_events" OWNER TO "postgres";

CREATE INDEX "alert_events_created_at_idx" ON "public"."alert_events" ("created_at" DESC);
CREATE INDEX "alert_events_rule_entity_idx"
    ON "public"."alert_events" ("rule_id", "env", "entity_id", "created_at" DESC);

-- Overlap guard: the evaluate route takes this row-level lease before a pass
-- and releases it after; a stale lease (crashed pass) is stolen once expired.
CREATE TABLE "public"."alert_locks" (
    "name" text NOT NULL,
    "locked_at" timestamptz NOT NULL DEFAULT now(),
    "expires_at" timestamptz NOT NULL,
    "locked_by" text,
    CONSTRAINT "alert_locks_pkey" PRIMARY KEY ("name")
);

ALTER TABLE "public"."alert_locks" OWNER TO "postgres";

-- Absence ("node gone silent") rules skip nodes that are deliberately down.
ALTER TABLE "public"."obs_nodes" ADD COLUMN "maintenance" boolean NOT NULL DEFAULT false;
ALTER TABLE "public"."ingest_nodes" ADD COLUMN "maintenance" boolean NOT NULL DEFAULT false;

-- RLS: the engine runs as service_role (bypasses RLS, needs GRANTs). Admins
-- can read state/history for the Alerts UI; alert_locks is engine-internal.
ALTER TABLE "public"."alert_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."alert_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."alert_locks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read alert state" ON "public"."alert_state"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.check_user_role('admin') ) );

CREATE POLICY "Admins read alert events" ON "public"."alert_events"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.check_user_role('admin') ) );

GRANT ALL ON TABLE "public"."alert_state" TO "service_role";
GRANT ALL ON TABLE "public"."alert_events" TO "service_role";
GRANT ALL ON TABLE "public"."alert_locks" TO "service_role";
GRANT SELECT ON TABLE "public"."alert_state" TO "authenticated";
GRANT SELECT ON TABLE "public"."alert_events" TO "authenticated";
