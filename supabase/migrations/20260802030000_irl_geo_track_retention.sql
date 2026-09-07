-- GPS overlays log every fix (~1 row/s while live) so walks can be replayed
-- when tuning the distance/speed math. Full resolution is the point; the
-- trade-off is unbounded growth, so rows older than 30 days are purged daily.

CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "extensions";

SELECT cron.schedule(
    'purge-irl-geo-track',
    '17 3 * * *',
    $$ DELETE FROM public.irl_geo_track WHERE inserted_at < now() - interval '30 days' $$
);
