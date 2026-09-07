-- OBS cloud panel: Wings-style node linking. A node row starts 'pending' when
-- an admin creates it via the panel UI, then self-links by calling
-- POST /api/nodes/claim with a one-time token during obs-instance-manager's
-- install script. claim_token_hash/claim_token_expires_at are only ever
-- populated for a pending node and are nulled out (single-use) once linked.
ALTER TABLE "public"."obs_nodes"
    ADD COLUMN "status" text NOT NULL DEFAULT 'pending',
    ADD COLUMN "claim_token_hash" text,
    ADD COLUMN "claim_token_expires_at" timestamptz,
    ADD CONSTRAINT "obs_nodes_status_check" CHECK ("status" IN ('pending', 'linked', 'offline', 'disabled'));

-- Port ranges are no longer published per-instance by the node -- replaced by
-- an internal websocket proxy. gpu_bus_id is unknown until a node links in,
-- so it can no longer be NOT NULL.
ALTER TABLE "public"."obs_nodes"
    ALTER COLUMN "gpu_bus_id" DROP NOT NULL,
    DROP COLUMN "vnc_port_start",
    DROP COLUMN "vnc_port_end",
    DROP COLUMN "novnc_port_start",
    DROP COLUMN "novnc_port_end",
    DROP COLUMN "obs_ws_port_start",
    DROP COLUMN "obs_ws_port_end";

ALTER TABLE "public"."obs_instances"
    DROP COLUMN "vnc_port",
    DROP COLUMN "novnc_port",
    DROP COLUMN "obs_ws_port";

-- Existing rows (the seeded default node) are already running -- backfill to linked.
UPDATE "public"."obs_nodes" SET "status" = 'linked';

CREATE UNIQUE INDEX IF NOT EXISTS "obs_nodes_claim_token_hash_idx"
    ON "public"."obs_nodes" ("claim_token_hash") WHERE "claim_token_hash" IS NOT NULL;
