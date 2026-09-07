-- Always reflect the guild's current live member count, even on repeat calls
-- for the same member (e.g. /test-welcome), instead of keeping a stable
-- number assigned on first join.
CREATE OR REPLACE FUNCTION "public"."record_guild_member_join"("p_guild_id" text, "p_user_id" text, "p_member_count" integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.discord_guild_members (guild_id, user_id, join_number)
    VALUES (p_guild_id, p_user_id, p_member_count)
    ON CONFLICT (guild_id, user_id) DO UPDATE SET join_number = excluded.join_number;

    RETURN p_member_count;
END;
$$;
