-- Per-rule overrides for the alert engine's rule catalog. The catalog itself
-- (query logic, defaults) lives in code (web-admin src/lib/alerts/rules.ts);
-- this table stores only admin-edited deviations from those defaults so
-- thresholds can be tuned from the Alerts UI without a deploy. NULL columns
-- mean "use the code default"; a missing row means the rule is untouched.
-- The engine (service_role) re-reads this table on every evaluation tick.
CREATE TABLE "public"."alert_rule_config" (
    "rule_id" text NOT NULL,
    "enabled" boolean NOT NULL DEFAULT true,
    "warn" double precision,
    "crit" double precision,
    "for_ticks" integer,
    "envs" text[],
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "updated_by" uuid,
    CONSTRAINT "alert_rule_config_pkey" PRIMARY KEY ("rule_id"),
    CONSTRAINT "alert_rule_config_for_ticks_check"
        CHECK ("for_ticks" IS NULL OR ("for_ticks" >= 1 AND "for_ticks" <= 10)),
    CONSTRAINT "alert_rule_config_envs_check"
        CHECK ("envs" IS NULL OR ("envs" <@ ARRAY['prod', 'staging', 'dev'] AND array_length("envs", 1) >= 1))
);

ALTER TABLE "public"."alert_rule_config" OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "alert_rule_config_updated_at"
    BEFORE UPDATE ON "public"."alert_rule_config"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- RLS: writes go through web-admin server actions (service_role, after an
-- explicit admin check); admins can read for the rules UI.
ALTER TABLE "public"."alert_rule_config" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read alert rule config" ON "public"."alert_rule_config"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.check_user_role('admin') ) );

GRANT ALL ON TABLE "public"."alert_rule_config" TO "service_role";
GRANT SELECT ON TABLE "public"."alert_rule_config" TO "authenticated";
