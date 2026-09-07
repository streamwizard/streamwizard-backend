-- Passive engagement tracking for the Discord bot: messages, reactions, and
-- voice time, rolled up per member/guild/day so we can show /rank, /leaderboard
-- and an end-of-year /recap. Storage is intentionally compact — daily rollups
-- plus voice-session intervals, never a per-event log and never message content.
-- All tables are bot-only (service-role); no anon/authenticated access.

-- ---------------------------------------------------------------------------
-- Per-guild tracking configuration. A guild with no row uses the defaults
-- below (tracking on). Managed at runtime via the bot's /setup wizard, which
-- is gated by Discord's native "Manage Server" permission.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."discord_activity_settings" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL,
    "tracking_enabled" boolean NOT NULL DEFAULT true,
    "track_messages" boolean NOT NULL DEFAULT true,
    "track_reactions" boolean NOT NULL DEFAULT true,
    "track_voice" boolean NOT NULL DEFAULT true,
    -- Don't credit voice time while self-muted or self-deafened (AFK farming).
    "voice_ignore_afk" boolean NOT NULL DEFAULT true,
    -- Don't credit voice time when the member is alone in the channel.
    "voice_require_others" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_activity_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discord_activity_settings_guild_id_unique" UNIQUE ("guild_id")
);

ALTER TABLE "public"."discord_activity_settings" OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "discord_activity_settings_updated_at"
    BEFORE UPDATE ON "public"."discord_activity_settings"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE "public"."discord_activity_settings" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "public"."discord_activity_settings" TO "service_role";

-- ---------------------------------------------------------------------------
-- Channels excluded from tracking (e.g. #bot-spam). Messages/reactions in
-- these channels are ignored.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."discord_activity_ignored_channels" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL,
    "channel_id" text NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_activity_ignored_channels_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discord_activity_ignored_channels_unique" UNIQUE ("guild_id", "channel_id")
);

ALTER TABLE "public"."discord_activity_ignored_channels" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "discord_activity_ignored_channels_guild_idx"
    ON "public"."discord_activity_ignored_channels" USING btree ("guild_id");

ALTER TABLE "public"."discord_activity_ignored_channels" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "public"."discord_activity_ignored_channels" TO "service_role";

-- ---------------------------------------------------------------------------
-- The core rollup: one row per member, per guild, per day. Counters are
-- incremented atomically via increment_daily_activity().
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."discord_daily_activity" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL,
    "user_id" text NOT NULL,
    "activity_date" date NOT NULL,
    "messages_sent" integer NOT NULL DEFAULT 0,
    "reactions_added" integer NOT NULL DEFAULT 0,
    "reactions_received" integer NOT NULL DEFAULT 0,
    "voice_seconds" integer NOT NULL DEFAULT 0,
    CONSTRAINT "discord_daily_activity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discord_daily_activity_unique" UNIQUE ("guild_id", "user_id", "activity_date")
);

ALTER TABLE "public"."discord_daily_activity" OWNER TO "postgres";

-- Leaderboard / recap reads filter by guild + date range, and per-user lookups
-- filter by guild + user.
CREATE INDEX IF NOT EXISTS "discord_daily_activity_guild_date_idx"
    ON "public"."discord_daily_activity" USING btree ("guild_id", "activity_date");
CREATE INDEX IF NOT EXISTS "discord_daily_activity_guild_user_idx"
    ON "public"."discord_daily_activity" USING btree ("guild_id", "user_id");

ALTER TABLE "public"."discord_daily_activity" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "public"."discord_daily_activity" TO "service_role";

-- ---------------------------------------------------------------------------
-- Eligible voice intervals. A new row opens when a member starts counting
-- voice time and closes (left_at + duration_seconds) when they leave or become
-- ineligible (mute/deafen/alone). Open rows (left_at IS NULL) are reconciled on
-- bot startup so a crash mid-session doesn't lose or double-count time.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."discord_voice_sessions" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL,
    "user_id" text NOT NULL,
    "channel_id" text NOT NULL,
    "joined_at" timestamptz NOT NULL DEFAULT now(),
    "left_at" timestamptz,
    "duration_seconds" integer,
    CONSTRAINT "discord_voice_sessions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."discord_voice_sessions" OWNER TO "postgres";

-- Find open sessions per guild (for startup reconciliation) and per member.
CREATE INDEX IF NOT EXISTS "discord_voice_sessions_guild_open_idx"
    ON "public"."discord_voice_sessions" USING btree ("guild_id", "left_at");
CREATE INDEX IF NOT EXISTS "discord_voice_sessions_guild_user_idx"
    ON "public"."discord_voice_sessions" USING btree ("guild_id", "user_id");

ALTER TABLE "public"."discord_voice_sessions" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "public"."discord_voice_sessions" TO "service_role";

-- ---------------------------------------------------------------------------
-- Atomically upsert-and-increment a member's daily counters. Called from the
-- bot's batched flush, so each call may carry several events' worth of counts.
-- SECURITY INVOKER: the bot connects as service_role, which has full table
-- access, so RLS is bypassed for that role and no elevated definer is needed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."increment_daily_activity"(
    "p_guild_id" text,
    "p_user_id" text,
    "p_date" date,
    "p_messages" integer,
    "p_reactions_added" integer,
    "p_reactions_received" integer,
    "p_voice_seconds" integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    INSERT INTO public.discord_daily_activity AS d (
        guild_id, user_id, activity_date,
        messages_sent, reactions_added, reactions_received, voice_seconds
    )
    VALUES (
        p_guild_id, p_user_id, p_date,
        p_messages, p_reactions_added, p_reactions_received, p_voice_seconds
    )
    ON CONFLICT (guild_id, user_id, activity_date) DO UPDATE SET
        messages_sent      = d.messages_sent      + excluded.messages_sent,
        reactions_added    = d.reactions_added    + excluded.reactions_added,
        reactions_received = d.reactions_received + excluded.reactions_received,
        voice_seconds      = d.voice_seconds      + excluded.voice_seconds;
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."increment_daily_activity"(text, text, date, integer, integer, integer, integer) TO "service_role";
