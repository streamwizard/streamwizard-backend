-- Ingest output keys: the credential an OBS Media Source presents (as the SRT
-- streamid) to PULL a streamer's passthrough feed from the ingest output
-- listener. Separate from the incoming stream key (ingest_stream_keys) so the
-- two rotate independently, and so one incoming stream can fan out to multiple
-- OBS pulls — one output key each, all pointing at the same input key_id.
--
-- Validated by the ingest control plane (service-role) when an OBS instance
-- connects to the shared output port: the control plane resolves output_key ->
-- the active input stream and the media plane wires that feed to the caller.
-- Mirrors the ingest_stream_keys pattern (high-entropy key, is_active, last_used_at).

CREATE TABLE IF NOT EXISTS "public"."ingest_output_keys" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL,
    "key_id" uuid NOT NULL,
    "output_key" text NOT NULL,
    "label" text NOT NULL DEFAULT 'My OBS Output Key'::text,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "last_used_at" timestamptz,
    CONSTRAINT "ingest_output_keys_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ingest_output_keys_output_key_key" UNIQUE ("output_key"),
    CONSTRAINT "ingest_output_keys_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    CONSTRAINT "ingest_output_keys_key_id_fkey" FOREIGN KEY ("key_id")
        REFERENCES "public"."ingest_stream_keys"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."ingest_output_keys" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "ingest_output_keys_user_id_idx"
    ON "public"."ingest_output_keys" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "ingest_output_keys_key_id_idx"
    ON "public"."ingest_output_keys" USING btree ("key_id");

-- RLS: owners manage their own output keys; the control plane uses the
-- service-role client (which bypasses RLS) to resolve a key on OBS connect.
ALTER TABLE "public"."ingest_output_keys" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ingest output keys" ON "public"."ingest_output_keys"
    USING (((SELECT auth.uid()) = "user_id"));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."ingest_output_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."ingest_output_keys" TO "service_role";
