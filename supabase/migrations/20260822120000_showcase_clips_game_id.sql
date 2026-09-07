-- Adds game_id to the landing page's showcase clips so the public clips demo can
-- offer the same Category filter the dashboard does. game_name is null on every
-- clip row (the product resolves category names through the Twitch API, not the
-- column), so the id is what the page needs; the name is looked up server-side.
-- Same ranking and same policy story as the original function: it only reads the
-- world-readable clips table and exposes no column the table policy hides.
DROP FUNCTION IF EXISTS "public"."get_showcase_clips"(integer, integer);

CREATE OR REPLACE FUNCTION "public"."get_showcase_clips"(
  "p_limit" integer DEFAULT 8,
  "p_per_broadcaster" integer DEFAULT 2
) RETURNS TABLE(
  "twitch_clip_id" "text",
  "title" "text",
  "creator_name" "text",
  "broadcaster_name" "text",
  "view_count" integer,
  "duration" numeric,
  "thumbnail_url" "text",
  "url" "text",
  "embed_url" "text",
  "created_at_twitch" timestamp with time zone,
  "game_id" "text"
)
LANGUAGE "sql" STABLE
SET "search_path" = 'public'
AS $$
  SELECT twitch_clip_id, title, creator_name, broadcaster_name, view_count, duration, thumbnail_url, url, embed_url, created_at_twitch, game_id
  FROM (
    SELECT
      c.twitch_clip_id,
      c.title,
      c.creator_name,
      c.broadcaster_name,
      c.view_count,
      c.duration,
      c.thumbnail_url,
      c.url,
      c.embed_url,
      c.created_at_twitch,
      c.game_id,
      row_number() OVER (
        PARTITION BY c.broadcaster_id
        ORDER BY c.view_count DESC, c.created_at_twitch DESC
      ) AS rn
    FROM public.clips c
    WHERE c.thumbnail_url IS NOT NULL
      AND c.view_count >= 5
      AND length(btrim(c.title)) BETWEEN 4 AND 80
  ) ranked
  WHERE rn <= greatest(1, least(p_per_broadcaster, 5))
  ORDER BY view_count DESC
  LIMIT greatest(1, least(p_limit, 24));
$$;

ALTER FUNCTION "public"."get_showcase_clips"(integer, integer) OWNER TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_showcase_clips"(integer, integer) TO "anon";
GRANT EXECUTE ON FUNCTION "public"."get_showcase_clips"(integer, integer) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_showcase_clips"(integer, integer) TO "service_role";
