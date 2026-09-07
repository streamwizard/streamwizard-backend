-- Per-node API keys for authenticating node→rest-api requests (e.g. reconcile
-- reports). key_hash enables O(1) auth lookup; key_ciphertext/iv/tag store the
-- AES-256-GCM encrypted key (TOKEN_ENCRYPTION_KEY) so admins can retrieve or
-- rotate it — matching the Twitch token / OBS WS password storage pattern.
-- Cascades on node deletion so orphaned keys can't pile up.
CREATE TABLE "public"."obs_node_api_keys" (
    "id"               uuid        NOT NULL DEFAULT gen_random_uuid(),
    "node_id"          uuid        NOT NULL,
    "key_hash"         text        NOT NULL,
    "key_ciphertext"   text        NOT NULL,
    "key_iv"           text        NOT NULL,
    "key_tag"          text        NOT NULL,
    "created_at"       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "obs_node_api_keys_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "obs_node_api_keys_node_id_fkey" FOREIGN KEY ("node_id")
        REFERENCES "public"."obs_nodes"("id") ON DELETE CASCADE
);

-- key_hash lookups on every authenticated node request must be fast.
CREATE UNIQUE INDEX "obs_node_api_keys_key_hash_idx"  ON "public"."obs_node_api_keys" ("key_hash");
CREATE        INDEX "obs_node_api_keys_node_id_idx"   ON "public"."obs_node_api_keys" ("node_id");

ALTER TABLE "public"."obs_node_api_keys" ENABLE ROW LEVEL SECURITY;

-- Admins can read and manage all node API keys.
CREATE POLICY "Admins manage node api keys" ON "public"."obs_node_api_keys"
    AS PERMISSIVE FOR ALL TO authenticated
    USING      ( ( SELECT public.check_user_role('admin') ) )
    WITH CHECK ( ( SELECT public.check_user_role('admin') ) );

-- The backend (service_role) inserts keys during /claim and reads them during
-- nodeAuth — it bypasses RLS but needs the GRANT to satisfy the ACL check.
GRANT ALL    ON TABLE "public"."obs_node_api_keys" TO "service_role";
GRANT SELECT ON TABLE "public"."obs_node_api_keys" TO "authenticated";
