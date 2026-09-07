-- The admin's browser needs to know where to reach each linked node's API
-- directly -- api_url is supplied by the admin when creating the node (they
-- know its reachable address). Admin access to /admin/metrics/stream is
-- authenticated with the admin's own Supabase JWT (checked against
-- user_roles on the node itself), the same way end users already connect
-- directly to /metrics/stream, /instances/:id/novnc, and
-- /instances/:id/obsws -- so no separate node-wide secret is stored here.
ALTER TABLE "public"."obs_nodes"
    ADD COLUMN IF NOT EXISTS "api_url" text;
