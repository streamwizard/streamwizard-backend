-- The original init migration granted anon/authenticated full table
-- privileges (including TRUNCATE) on the integration tables, relying on
-- RLS to restrict actual row access. RLS does cover SELECT/INSERT/UPDATE/
-- DELETE, but NOT TRUNCATE -- that privilege bypasses RLS entirely. None
-- of these privileges are exercised by the app (writes happen only via
-- SECURITY DEFINER functions, which run with the function owner's
-- privileges regardless of the caller's grants), so it's safe to drop
-- them down to what's actually used: SELECT/UPDATE for authenticated
-- (matching the existing RLS policies), nothing for anon, full access
-- only for service_role.
REVOKE ALL ON TABLE "public"."integrations" FROM "anon";
REVOKE ALL ON TABLE "public"."integrations" FROM "authenticated";
GRANT SELECT, UPDATE ON TABLE "public"."integrations" TO "authenticated";

REVOKE ALL ON TABLE "public"."integrations_twitch" FROM "anon";
REVOKE ALL ON TABLE "public"."integrations_twitch" FROM "authenticated";
GRANT SELECT, UPDATE ON TABLE "public"."integrations_twitch" TO "authenticated";

REVOKE ALL ON TABLE "public"."integrations_discord" FROM "anon";
REVOKE ALL ON TABLE "public"."integrations_discord" FROM "authenticated";
GRANT SELECT, UPDATE ON TABLE "public"."integrations_discord" TO "authenticated";
