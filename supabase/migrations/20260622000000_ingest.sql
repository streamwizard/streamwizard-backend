-- Ingest server: per-user stream keys and live ingest sessions.
--
-- A stream key is the credential an IRL streamer puts in their encoder. It is
-- validated by the ingest control plane (service-role) on every RTMP/SRT/SRTLA
-- connect and maps the incoming stream to a Supabase user. Mirrors the
-- irl_collector_tokens pattern (high-entropy token, is_active flag, last_used_at).

CREATE TABLE IF NOT EXISTS "public"."ingest_stream_keys" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL,
    "stream_key" text NOT NULL,
    "label" text NOT NULL DEFAULT 'My Ingest Key'::text,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "last_used_at" timestamptz,
    CONSTRAINT "ingest_stream_keys_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ingest_stream_keys_stream_key_key" UNIQUE ("stream_key"),
    CONSTRAINT "ingest_stream_keys_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "auth"."users"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."ingest_stream_keys" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "ingest_stream_keys_user_id_idx"
    ON "public"."ingest_stream_keys" USING btree ("user_id");

-- A row per ingest connection, opened on authorize and closed on disconnect.
CREATE TABLE IF NOT EXISTS "public"."ingest_sessions" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL,
    "key_id" uuid NOT NULL,
    "protocol" text NOT NULL,
    "remote_ip" inet,
    "started_at" timestamptz NOT NULL DEFAULT now(),
    "ended_at" timestamptz,
    "last_bitrate_kbps" integer,
    CONSTRAINT "ingest_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ingest_sessions_protocol_check" CHECK ("protocol" IN ('rtmp', 'srt', 'srtla')),
    CONSTRAINT "ingest_sessions_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    CONSTRAINT "ingest_sessions_key_id_fkey" FOREIGN KEY ("key_id")
        REFERENCES "public"."ingest_stream_keys"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."ingest_sessions" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "ingest_sessions_user_id_idx"
    ON "public"."ingest_sessions" USING btree ("user_id");

-- RLS: owners manage their own keys and read their own sessions; the control
-- plane uses the service-role client (which bypasses RLS) for validation/writes.
ALTER TABLE "public"."ingest_stream_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ingest_sessions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ingest keys" ON "public"."ingest_stream_keys"
    USING (((SELECT auth.uid()) = "user_id"));

CREATE POLICY "Users read own ingest sessions" ON "public"."ingest_sessions"
    FOR SELECT USING (((SELECT auth.uid()) = "user_id"));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."ingest_stream_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."ingest_stream_keys" TO "service_role";

GRANT SELECT ON TABLE "public"."ingest_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."ingest_sessions" TO "service_role";
