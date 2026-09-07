-- Account-linking entry point for an already-authenticated user connecting
-- Discord from the web app or via the bot's /link command (as opposed to
-- insert_discord_integration, which only runs once at signup-trigger time).
-- Idempotent: re-running it (re-link after disconnect, refreshed OAuth
-- grant) just updates the existing row instead of failing.
CREATE OR REPLACE FUNCTION "public"."link_discord_integration"(
    "p_discord_user_id" "text", "p_discord_username" "text", "p_avatar" "text", "p_email" "text"
) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    INSERT INTO public.integrations (user_id) VALUES (v_user_id) ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.integrations_discord (user_id, discord_user_id, discord_username, avatar, email)
    VALUES (v_user_id, p_discord_user_id, p_discord_username, p_avatar, p_email)
    ON CONFLICT (user_id) DO UPDATE SET
        discord_user_id = EXCLUDED.discord_user_id,
        discord_username = EXCLUDED.discord_username,
        avatar = EXCLUDED.avatar,
        email = EXCLUDED.email;
END;
$$;

ALTER FUNCTION "public"."link_discord_integration"("text", "text", "text", "text") OWNER TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."link_discord_integration"("text", "text", "text", "text") TO "authenticated";
