-- Use Discord's live guild.memberCount (passed in by the bot) as the join
-- number instead of a separately maintained counter, while still snapshotting
-- it per-member so it stays stable after people leave.
DROP FUNCTION IF EXISTS "public"."record_guild_member_join"("p_guild_id" text, "p_user_id" text);

CREATE OR REPLACE FUNCTION "public"."record_guild_member_join"("p_guild_id" text, "p_user_id" text, "p_member_count" integer)
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

    INSERT INTO public.discord_guild_members (guild_id, user_id, join_number)
    VALUES (p_guild_id, p_user_id, p_member_count);

    RETURN p_member_count;
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."record_guild_member_join"(text, text, integer) TO "service_role";

ALTER TABLE "public"."discord_guild_settings"
    DROP COLUMN IF EXISTS "member_count";
