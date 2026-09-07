-- Ingest fleet: Wings-style node registration for ingest-server boxes,
-- mirroring obs_nodes/obs_node_api_keys. A node row starts 'pending' when an
-- admin creates it via the panel UI, then self-links by calling
-- POST /api/ingest-nodes/claim with a one-time token during ingest-server's
-- install script. claim_token_hash/claim_token_expires_at are only ever
-- populated for a pending node and are nulled out (single-use) once linked.
--
-- Unlike obs_nodes, there is no GPU/api_url concept here: nothing calls into
-- an ingest node's own HTTP API (it's never published), and there's no
-- hardware identity field as strict as gpu_bus_id -- the claim token alone
-- gates linking. There's also no 'offline' status value: nothing drives that
-- transition without a heartbeat mechanism, which doesn't exist yet.
CREATE TABLE "public"."ingest_nodes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "name" text NOT NULL,
    "max_concurrent_sessions" integer,
    "status" text NOT NULL DEFAULT 'pending',
    "claim_token_hash" text,
    "claim_token_expires_at" timestamptz,
    "hostname" text,
    "cpu_cores" integer,
    "ram_total_mb" integer,
    "storage_total_mb" integer,
    "public_ip" text,
    "lan_ip" text,
    "tailscale_ip" text,
    "control_secret_ciphertext" text,
    "control_secret_iv" text,
    "control_secret_tag" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "ingest_nodes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ingest_nodes_name_key" UNIQUE ("name"),
    CONSTRAINT "ingest_nodes_status_check" CHECK ("status" IN ('pending', 'linked', 'disabled'))
);

ALTER TABLE "public"."ingest_nodes" OWNER TO "postgres";

CREATE UNIQUE INDEX "ingest_nodes_claim_token_hash_idx"
    ON "public"."ingest_nodes" ("claim_token_hash") WHERE "claim_token_hash" IS NOT NULL;

CREATE OR REPLACE TRIGGER "ingest_nodes_updated_at"
    BEFORE UPDATE ON "public"."ingest_nodes"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- Per-node API keys for authenticating a future ingest-node -> rest-api
-- request (e.g. a heartbeat/reconcile report). Not consumed by anything yet,
-- written now for forward-compat with the same pattern obs_node_api_keys
-- already established. key_hash enables O(1) auth lookup; key_ciphertext/
-- iv/tag store the AES-256-GCM encrypted key so admins can retrieve/rotate it.
CREATE TABLE "public"."ingest_node_api_keys" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "node_id" uuid NOT NULL,
    "key_hash" text NOT NULL,
    "key_ciphertext" text NOT NULL,
    "key_iv" text NOT NULL,
    "key_tag" text NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "ingest_node_api_keys_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ingest_node_api_keys_node_id_fkey" FOREIGN KEY ("node_id")
        REFERENCES "public"."ingest_nodes"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."ingest_node_api_keys" OWNER TO "postgres";

CREATE UNIQUE INDEX "ingest_node_api_keys_key_hash_idx" ON "public"."ingest_node_api_keys" ("key_hash");
CREATE INDEX "ingest_node_api_keys_node_id_idx" ON "public"."ingest_node_api_keys" ("node_id");

-- RLS: ingest_nodes is backend/service-role only, with no public policies at
-- all -- same as obs_nodes. ingest_node_api_keys allows admins to read/manage
-- (for rotation/inspection), same as obs_node_api_keys.
ALTER TABLE "public"."ingest_nodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ingest_node_api_keys" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ingest node api keys" ON "public"."ingest_node_api_keys"
    AS PERMISSIVE FOR ALL TO authenticated
    USING      ( ( SELECT public.check_user_role('admin') ) )
    WITH CHECK ( ( SELECT public.check_user_role('admin') ) );

GRANT ALL ON TABLE "public"."ingest_nodes" TO "service_role";

-- The backend (service_role) inserts keys during /claim -- it bypasses RLS
-- but needs the GRANT to satisfy the ACL check.
GRANT ALL ON TABLE "public"."ingest_node_api_keys" TO "service_role";
GRANT SELECT ON TABLE "public"."ingest_node_api_keys" TO "authenticated";
