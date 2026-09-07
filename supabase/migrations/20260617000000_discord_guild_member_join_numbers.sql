-- Fun feature: remember which number a member joined the server at (e.g.
-- "you're member #47"), so it's stable even after people leave and the
-- live Discord member count moves on.
ALTER TABLE "public"."discord_guild_settings"
    ADD COLUMN IF NOT EXISTS "member_count" integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "public"."discord_guild_members" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL,
    "user_id" text NOT NULL,
    "join_number" integer NOT NULL,
    "joined_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_guild_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discord_guild_members_guild_user_unique" UNIQUE ("guild_id", "user_id")
);

ALTER TABLE "public"."discord_guild_members" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "discord_guild_members_guild_idx"
    ON "public"."discord_guild_members" USING btree ("guild_id");

ALTER TABLE "public"."discord_guild_members" ENABLE ROW LEVEL SECURITY;

-- Only the bot's service-role client reads/writes this table; no anon/authenticated access.
GRANT ALL ON TABLE "public"."discord_guild_members" TO "service_role";

-- Atomically assigns (or returns the existing) join number for a member.
-- Safe to call more than once for the same member: it's idempotent and
-- only increments the guild's counter the first time.
CREATE OR REPLACE FUNCTION "public"."record_guild_member_join"("p_guild_id" text, "p_user_id" text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_join_number integer;
BEGIN
    SELECT join_number INTO v_join_number
    FROM public.discord_guild_members
    WHERE guild_id = p_guild_id AND user_id = p_user_id;

    IF v_join_number IS NOT NULL THEN
        RETURN v_join_number;
    END IF;

    INSERT INTO public.discord_guild_settings (guild_id, member_count)
    VALUES (p_guild_id, 1)
    ON CONFLICT (guild_id) DO UPDATE SET member_count = discord_guild_settings.member_count + 1
    RETURNING member_count INTO v_join_number;

    INSERT INTO public.discord_guild_members (guild_id, user_id, join_number)
    VALUES (p_guild_id, p_user_id, v_join_number);

    RETURN v_join_number;
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."record_guild_member_join"(text, text) TO "service_role";
