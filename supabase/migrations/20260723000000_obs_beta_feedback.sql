-- Beta test feedback for Cloud OBS: one row per tester, answers stored as jsonb
-- keyed by test-case id so the web form can evolve without schema changes.

CREATE TABLE "public"."obs_beta_feedback" (
    "user_id" uuid NOT NULL,
    "tester_info" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "responses" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "overall" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "status" text NOT NULL DEFAULT 'draft',
    "submitted_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "obs_beta_feedback_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "obs_beta_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    CONSTRAINT "obs_beta_feedback_status_check" CHECK ("status" IN ('draft', 'submitted'))
);

ALTER TABLE "public"."obs_beta_feedback" OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "obs_beta_feedback_updated_at"
    BEFORE UPDATE ON "public"."obs_beta_feedback"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE "public"."obs_beta_feedback" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own beta feedback" ON "public"."obs_beta_feedback"
    FOR SELECT USING (((SELECT auth.uid()) = "user_id"));
CREATE POLICY "Users insert own beta feedback" ON "public"."obs_beta_feedback"
    FOR INSERT WITH CHECK (((SELECT auth.uid()) = "user_id"));
CREATE POLICY "Users update own beta feedback" ON "public"."obs_beta_feedback"
    FOR UPDATE USING (((SELECT auth.uid()) = "user_id"))
    WITH CHECK (((SELECT auth.uid()) = "user_id"));
CREATE POLICY "Users delete own beta feedback" ON "public"."obs_beta_feedback"
    FOR DELETE USING (((SELECT auth.uid()) = "user_id"));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."obs_beta_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."obs_beta_feedback" TO "service_role";
