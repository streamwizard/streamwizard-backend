-- insert_integration/insert_twitch_integration/insert_discord_integration
-- are only meant to be called internally by the handle_new_user_integration
-- trigger (which runs as the function owner regardless of grants). They do
-- no caller-identity check, so granting EXECUTE to anon/authenticated let
-- any client call them directly with an arbitrary user_id and plant fake
-- profile data on someone else's account. Nothing in app code calls these
-- via supabase.rpc(), so it's safe to revoke.
-- Postgres grants EXECUTE to PUBLIC by default at function creation time,
-- which anon/authenticated inherit implicitly even without an explicit
-- GRANT naming them — that default must be revoked too, not just the
-- explicit grants the original migration added.
REVOKE ALL ON FUNCTION "public"."insert_integration"("p_user_id" "uuid") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."insert_integration"("p_user_id" "uuid") FROM "anon";
REVOKE ALL ON FUNCTION "public"."insert_integration"("p_user_id" "uuid") FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."insert_twitch_integration"("p_user_id" "uuid", "provider_data" "jsonb") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."insert_twitch_integration"("p_user_id" "uuid", "provider_data" "jsonb") FROM "anon";
REVOKE ALL ON FUNCTION "public"."insert_twitch_integration"("p_user_id" "uuid", "provider_data" "jsonb") FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."insert_discord_integration"("p_user_id" "uuid", "provider_data" "jsonb") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."insert_discord_integration"("p_user_id" "uuid", "provider_data" "jsonb") FROM "anon";
REVOKE ALL ON FUNCTION "public"."insert_discord_integration"("p_user_id" "uuid", "provider_data" "jsonb") FROM "authenticated";
