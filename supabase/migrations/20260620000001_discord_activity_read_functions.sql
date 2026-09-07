-- Read-side aggregation for the activity-tracking commands (/rank, /leaderboard,
-- /serverstats, /recap). Kept in SQL so a leaderboard sums across the rollup in
-- the database instead of shipping every daily row to the bot. All functions are
-- SECURITY INVOKER and granted to service_role only (the bot's client).

-- Per-member totals across a date range (inclusive).
CREATE OR REPLACE FUNCTION "public"."get_user_activity_totals"(
    "p_guild_id" text,
    "p_user_id" text,
    "p_from" date,
    "p_to" date
)
RETURNS TABLE (
    messages_sent bigint,
    reactions_added bigint,
    reactions_received bigint,
    voice_seconds bigint
)
LANGUAGE sql
SECURITY INVOKER
AS $$
    SELECT
        COALESCE(SUM(d.messages_sent), 0),
        COALESCE(SUM(d.reactions_added), 0),
        COALESCE(SUM(d.reactions_received), 0),
        COALESCE(SUM(d.voice_seconds), 0)
    FROM public.discord_daily_activity d
    WHERE d.guild_id = p_guild_id
      AND d.user_id = p_user_id
      AND d.activity_date >= p_from
      AND d.activity_date <= p_to;
$$;

GRANT EXECUTE ON FUNCTION "public"."get_user_activity_totals"(text, text, date, date) TO "service_role";

-- Server-wide totals + count of members active in the range.
CREATE OR REPLACE FUNCTION "public"."get_server_activity_totals"(
    "p_guild_id" text,
    "p_from" date,
    "p_to" date
)
RETURNS TABLE (
    messages_sent bigint,
    reactions_added bigint,
    reactions_received bigint,
    voice_seconds bigint,
    active_members bigint
)
LANGUAGE sql
SECURITY INVOKER
AS $$
    SELECT
        COALESCE(SUM(d.messages_sent), 0),
        COALESCE(SUM(d.reactions_added), 0),
        COALESCE(SUM(d.reactions_received), 0),
        COALESCE(SUM(d.voice_seconds), 0),
        COUNT(DISTINCT d.user_id)
    FROM public.discord_daily_activity d
    WHERE d.guild_id = p_guild_id
      AND d.activity_date >= p_from
      AND d.activity_date <= p_to;
$$;

GRANT EXECUTE ON FUNCTION "public"."get_server_activity_totals"(text, date, date) TO "service_role";

-- Top members by a single metric over a date range. p_metric is one of
-- 'messages', 'voice', 'reactions' (reactions added). Unknown values fall back
-- to messages.
CREATE OR REPLACE FUNCTION "public"."get_activity_leaderboard"(
    "p_guild_id" text,
    "p_metric" text,
    "p_from" date,
    "p_to" date,
    "p_limit" integer
)
RETURNS TABLE (
    user_id text,
    total bigint
)
LANGUAGE sql
SECURITY INVOKER
AS $$
    SELECT
        d.user_id,
        SUM(
            CASE p_metric
                WHEN 'voice'     THEN d.voice_seconds
                WHEN 'reactions' THEN d.reactions_added
                ELSE d.messages_sent
            END
        )::bigint AS total
    FROM public.discord_daily_activity d
    WHERE d.guild_id = p_guild_id
      AND d.activity_date >= p_from
      AND d.activity_date <= p_to
    GROUP BY d.user_id
    HAVING SUM(
        CASE p_metric
            WHEN 'voice'     THEN d.voice_seconds
            WHEN 'reactions' THEN d.reactions_added
            ELSE d.messages_sent
        END
    ) > 0
    ORDER BY total DESC
    LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION "public"."get_activity_leaderboard"(text, text, date, date, integer) TO "service_role";

-- A member's 1-based rank for a metric over a range, plus their own total and
-- the number of members with any activity. Rank counts members with a strictly
-- higher total. Returns rank 0 if the member has no activity in the range.
CREATE OR REPLACE FUNCTION "public"."get_user_activity_rank"(
    "p_guild_id" text,
    "p_user_id" text,
    "p_metric" text,
    "p_from" date,
    "p_to" date
)
RETURNS TABLE (
    rank bigint,
    total bigint,
    ranked_members bigint
)
LANGUAGE sql
SECURITY INVOKER
AS $$
    WITH totals AS (
        SELECT
            d.user_id,
            SUM(
                CASE p_metric
                    WHEN 'voice'     THEN d.voice_seconds
                    WHEN 'reactions' THEN d.reactions_added
                    ELSE d.messages_sent
                END
            )::bigint AS total
        FROM public.discord_daily_activity d
        WHERE d.guild_id = p_guild_id
          AND d.activity_date >= p_from
          AND d.activity_date <= p_to
        GROUP BY d.user_id
        HAVING SUM(
            CASE p_metric
                WHEN 'voice'     THEN d.voice_seconds
                WHEN 'reactions' THEN d.reactions_added
                ELSE d.messages_sent
            END
        ) > 0
    )
    SELECT
        COALESCE((SELECT COUNT(*) FROM totals t2 WHERE t2.total > me.total), 0) + 1 AS rank,
        me.total,
        (SELECT COUNT(*) FROM totals) AS ranked_members
    FROM totals me
    WHERE me.user_id = p_user_id
    UNION ALL
    SELECT 0, 0, (SELECT COUNT(*) FROM totals)
    WHERE NOT EXISTS (SELECT 1 FROM totals WHERE user_id = p_user_id)
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION "public"."get_user_activity_rank"(text, text, text, date, date) TO "service_role";
