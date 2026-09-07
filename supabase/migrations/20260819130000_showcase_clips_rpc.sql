-- Showcase clips for the public landing page: top clips by view count with a
-- per-broadcaster cap, so the marquee stays a mix of channels instead of one
-- broadcaster's back catalog. Clips are already world-readable ("Anyone can
-- view clips" SELECT policy), so this runs as the caller and only ranks rows;
-- it exposes no columns the table policy does not.
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
  "created_at_twitch" timestamp with time zone
)
LANGUAGE "sql" STABLE
SET "search_path" = 'public'
AS $$
  SELECT twitch_clip_id, title, creator_name, broadcaster_name, view_count, duration, thumbnail_url, url, embed_url, created_at_twitch
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
