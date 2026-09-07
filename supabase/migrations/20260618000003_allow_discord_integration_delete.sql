-- unlinkDiscord() (web app disconnect flow) deletes the caller's own row
-- directly via supabase-js, but 20260617000002_tighten_integrations_grants
-- revoked DELETE from authenticated without anticipating this path, and the
-- table never had a DELETE RLS policy to begin with (only SELECT/UPDATE).
-- Both are required: the grant lets authenticated issue DELETE at all, the
-- policy scopes it to the caller's own row.
CREATE POLICY "integrations_delete" ON "public"."integrations_discord" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));

GRANT DELETE ON TABLE "public"."integrations_discord" TO "authenticated";
