-- Safe, user-facing subset of the admin-only ingest_nodes table, for clients
-- that need to pick a stream destination (IRL app "StreamWizard mode").
-- Exposes only linked nodes with a reachable host, and only the fields needed
-- to build an SRT/SRTLA URL. security_invoker=off (definer) on purpose:
-- ingest_nodes has no RLS policies for regular users, the view IS the
-- access boundary.
CREATE OR REPLACE VIEW "public"."ingest_servers"
WITH (security_invoker = off) AS
SELECT id,
    name,
    COALESCE(public_hostname, public_ip) AS host,
    8888 AS srt_port,
    5000 AS srtla_port
   FROM public.ingest_nodes
  WHERE status = 'linked'::text
    AND COALESCE(public_hostname, public_ip) IS NOT NULL;

-- Read-only, signed-in users only.
REVOKE ALL ON "public"."ingest_servers" FROM PUBLIC;
REVOKE ALL ON "public"."ingest_servers" FROM anon;
REVOKE ALL ON "public"."ingest_servers" FROM authenticated;
GRANT SELECT ON "public"."ingest_servers" TO authenticated;
GRANT SELECT ON "public"."ingest_servers" TO service_role;
