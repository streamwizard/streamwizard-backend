-- OBS cloud panel: per-host node configuration and per-user OBS container
-- instances. A node is one Docker host running the OBS cloud container image;
-- an instance is one user's running (or stopped) container on that host,
-- created and managed entirely by the obs-instance-manager backend via the
-- service-role client. Mirrors the ingest_stream_keys/ingest_sessions pattern:
-- the backend owns all writes, users only ever read/delete their own rows.

-- Node config is never read or written by end users -- only the backend
-- (service-role) needs it, to decide port ranges, resource limits, and
-- capacity when provisioning a new instance.
CREATE TABLE IF NOT EXISTS "public"."obs_nodes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "name" text NOT NULL,
    "max_instances" integer NOT NULL,
    "vnc_port_start" integer NOT NULL,
    "vnc_port_end" integer NOT NULL,
    "novnc_port_start" integer NOT NULL,
    "novnc_port_end" integer NOT NULL,
    "obs_ws_port_start" integer NOT NULL,
    "obs_ws_port_end" integer NOT NULL,
    "memory_mb" integer NOT NULL,
    "cpu_quota" numeric NOT NULL,
    "vram_mb" integer NOT NULL,
    "total_vram_mb" integer NOT NULL,
    "shm_size" text NOT NULL,
    "gpu_bus_id" text NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "obs_nodes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."obs_nodes" OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "obs_nodes_updated_at"
    BEFORE UPDATE ON "public"."obs_nodes"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- One row per container the backend has created. container_id/status are
-- updated by the backend as it starts/stops/removes the underlying container.
CREATE TABLE IF NOT EXISTS "public"."obs_instances" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL,
    "node_id" uuid NOT NULL,
    "container_id" text,
    "container_name" text NOT NULL,
    "vnc_port" integer NOT NULL,
    "novnc_port" integer NOT NULL,
    "obs_ws_port" integer NOT NULL,
    "resolution" text NOT NULL,
    "status" text NOT NULL DEFAULT 'creating',
    "vram_allocated_mb" integer NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "obs_instances_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "obs_instances_status_check" CHECK ("status" IN ('creating', 'running', 'stopped', 'error')),
    CONSTRAINT "obs_instances_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    CONSTRAINT "obs_instances_node_id_fkey" FOREIGN KEY ("node_id")
        REFERENCES "public"."obs_nodes"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."obs_instances" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "obs_instances_user_id_idx" ON "public"."obs_instances" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "obs_instances_node_id_idx" ON "public"."obs_instances" USING btree ("node_id");

CREATE OR REPLACE TRIGGER "obs_instances_updated_at"
    BEFORE UPDATE ON "public"."obs_instances"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- RLS: obs_nodes is backend/service-role only, with no public policies at all.
-- obs_instances allows owners to read and delete their own rows; all inserts and
-- updates come from the backend via the service-role client, which bypasses RLS.
ALTER TABLE "public"."obs_nodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."obs_instances" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own obs instances" ON "public"."obs_instances"
    FOR SELECT USING (((SELECT auth.uid()) = "user_id"));

CREATE POLICY "Users delete own obs instances" ON "public"."obs_instances"
    FOR DELETE USING (((SELECT auth.uid()) = "user_id"));

GRANT ALL ON TABLE "public"."obs_nodes" TO "service_role";

GRANT SELECT, DELETE ON TABLE "public"."obs_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."obs_instances" TO "service_role";

-- Seed the single default node. Update gpu_bus_id to match the actual
-- production host (`nvidia-smi --query-gpu=pci.bus_id --format=csv,noheader`)
-- before provisioning real instances against it.
INSERT INTO "public"."obs_nodes" (
    "name",
    "max_instances",
    "vnc_port_start",
    "vnc_port_end",
    "novnc_port_start",
    "novnc_port_end",
    "obs_ws_port_start",
    "obs_ws_port_end",
    "memory_mb",
    "cpu_quota",
    "vram_mb",
    "total_vram_mb",
    "shm_size",
    "gpu_bus_id"
) VALUES (
    'default-node',
    10,
    5900,
    5909,
    6080,
    6089,
    4455,
    4464,
    4096,
    1,
    2048,
    8192,
    '2g',
    '00000000:01:00.0'
);
