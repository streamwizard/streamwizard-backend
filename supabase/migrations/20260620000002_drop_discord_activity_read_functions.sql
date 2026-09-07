-- The read-side aggregation for /rank, /leaderboard, /serverstats, /recap moved
-- to plain queries + JS aggregation (packages/supabase/src/queries/discord-activity.ts)
-- for consistency with the rest of the codebase's query layer. Only
-- increment_daily_activity remains as a database function — it needs Postgres's
-- atomic upsert to avoid lost updates under concurrent writes, which PostgREST
-- can't express as a plain query.
DROP FUNCTION IF EXISTS "public"."get_user_activity_totals"(text, text, date, date);
DROP FUNCTION IF EXISTS "public"."get_server_activity_totals"(text, date, date);
DROP FUNCTION IF EXISTS "public"."get_activity_leaderboard"(text, text, date, date, integer);
DROP FUNCTION IF EXISTS "public"."get_user_activity_rank"(text, text, text, date, date);
