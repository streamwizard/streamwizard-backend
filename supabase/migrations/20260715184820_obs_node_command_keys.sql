-- Per-node "command key" for the obs-auto-switcher's public /obs command route.
--
-- The switcher authenticates to each node's /obs/instances/:id/command endpoint
-- with a dedicated per-node key, stored as a SECOND obs_node_api_keys row
-- distinguished by `type`. Keeping it separate from the node's rest-api key
-- (type='rest_api') is the whole point: a command key travels to the node over
-- the public Cloudflare tunnel on every scene switch, so if it leaked it must
-- only be able to drive OBS scenes on that one node -- never authenticate as
-- the node to the rest-api. nodeAuth is updated to filter to type='rest_api',
-- so an obs_command key can never be used as a node login.
ALTER TABLE "public"."obs_node_api_keys"
    ADD COLUMN "type" text NOT NULL DEFAULT 'rest_api'
    CHECK ("type" IN ('rest_api', 'obs_command'));

-- nodeAuth (key_hash + type='rest_api') and the /me command-key-hash lookup
-- (node_id + type='obs_command') both benefit from this composite index.
CREATE INDEX "obs_node_api_keys_node_id_type_idx"
    ON "public"."obs_node_api_keys" ("node_id", "type");
