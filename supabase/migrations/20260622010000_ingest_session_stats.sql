-- Live connection-quality telemetry for ingest sessions (bitrate, and for
-- SRT/SRTLA, loss/RTT/bandwidth straight from libsrt's own accounting).
--
-- The media plane samples roughly every 2s; the control plane batches those
-- samples in memory and bulk-inserts every ~30s rather than writing a row per
-- sample, so write volume stays bounded regardless of how chatty the sampler
-- gets. This table is the durable history; "current" snapshots for an active
-- session are served from the control plane's in-memory cache, not from here.

CREATE TABLE IF NOT EXISTS "public"."ingest_session_stats" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "session_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "protocol" text NOT NULL,
    "recorded_at" timestamptz NOT NULL DEFAULT now(),
    "kbps" integer,
    "mbps_recv_rate" double precision,
    "mbps_bandwidth" double precision,
    "rtt_ms" double precision,
    "pkt_recv_loss" integer,
    "pkt_recv_drop" integer,
    "pkt_recv_retrans" integer,
    "pkt_recv_loss_total" integer,
    "byte_recv_total" bigint,
    CONSTRAINT "ingest_session_stats_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ingest_session_stats_protocol_check" CHECK ("protocol" IN ('rtmp', 'srt', 'srtla')),
    CONSTRAINT "ingest_session_stats_session_id_fkey" FOREIGN KEY ("session_id")
        REFERENCES "public"."ingest_sessions"("id") ON DELETE CASCADE,
    CONSTRAINT "ingest_session_stats_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "auth"."users"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."ingest_session_stats" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "ingest_session_stats_session_id_idx"
    ON "public"."ingest_session_stats" USING btree ("session_id", "recorded_at" DESC);

CREATE INDEX IF NOT EXISTS "ingest_session_stats_user_id_idx"
    ON "public"."ingest_session_stats" USING btree ("user_id");

ALTER TABLE "public"."ingest_session_stats" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own ingest session stats" ON "public"."ingest_session_stats"
    FOR SELECT USING (((SELECT auth.uid()) = "user_id"));

GRANT SELECT ON TABLE "public"."ingest_session_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."ingest_session_stats" TO "service_role";
