-- Backfill irl_geo_track.stream_id for rows logged by a GPS overlay that was
-- already connected when the stream went live.
--
-- ws-server resolved stream_id once, at publisher upgrade, so a phone that
-- opened the overlay before going live logged its whole walk with
-- stream_id = NULL. The forward fix is the /internal/stream-status push from
-- the stream.online/offline EventSub handlers; this repairs the history.
--
-- Attribution window: a vod's started_at until the next vod for the same
-- broadcaster, capped at 24h (vods has no ended_at, so the cap keeps a single
-- old stream from swallowing every later fix). stream_id is an FK onto
-- vods.stream_id, so only ids that exist there can be written.
-- irl_geo_track is on a 30-day retention job, so this touches at most a month.

WITH stream_windows AS (
  SELECT
    v.stream_id,
    ti.user_id,
    v.started_at,
    LEAST(
      COALESCE(
        LEAD(v.started_at) OVER (PARTITION BY v.broadcaster_id ORDER BY v.started_at),
        v.started_at + interval '24 hours'
      ),
      v.started_at + interval '24 hours'
    ) AS ends_at
  FROM public.vods v
  JOIN public.integrations_twitch ti ON ti.twitch_user_id = v.broadcaster_id
  WHERE v.stream_id IS NOT NULL
    AND v.started_at IS NOT NULL
)
UPDATE public.irl_geo_track g
SET stream_id = w.stream_id
FROM stream_windows w
WHERE g.stream_id IS NULL
  AND g.user_id = w.user_id
  AND g.recorded_at >= w.started_at
  AND g.recorded_at < w.ends_at;
