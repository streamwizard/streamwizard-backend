-- Drop the ingest_servers view.
--
-- 20260722210000_ingest_servers_view.sql added it as a safe, user-facing subset
-- of the admin-only ingest_nodes table, for the Android IRL app's "StreamWizard
-- mode" server picker. That app never shipped (still versionCode 1 / 0.1.0,
-- untagged) and nothing in this monorepo ever read the view, so it is now an
-- unused security-definer surface over ingest_nodes. Removing it shrinks the
-- attack surface rather than leaving a bypass of ingest_nodes' admin-only access
-- sitting around unused.
--
-- Nothing in the database depends on it (no views, no functions), so no CASCADE.
-- Recreate from the original migration if the IRL app is ever revived.

DROP VIEW IF EXISTS "public"."ingest_servers";
