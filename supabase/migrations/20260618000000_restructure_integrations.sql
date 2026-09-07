-- integrations was modeled as one row per user PER PROVIDER (sharing its id
-- PK 1:1 with each provider child table, discriminated by a provider_type
-- enum). That meant a user could only ever have ONE integration row total,
-- blocking a Twitch-signed-up user from ever linking Discord too.
-- Restructure to one integrations row per user, period, with each provider
-- child table relating via its own user_id instead of sharing the id PK.
ALTER TABLE "public"."integrations" DROP COLUMN "type";
ALTER TABLE "public"."integrations" DROP COLUMN "is_active";
-- existing UNIQUE(user_id) and FK to users(id) already match "one row per user".

ALTER TABLE "public"."integrations_twitch" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."integrations_twitch" DROP CONSTRAINT "integrations_twitch_id_fkey";
ALTER TABLE "public"."integrations_twitch" DROP CONSTRAINT "integrations_twitch_user_id_fkey";
ALTER TABLE "public"."integrations_twitch" ADD CONSTRAINT "integrations_twitch_user_id_key" UNIQUE ("user_id");
ALTER TABLE "public"."integrations_twitch" ADD CONSTRAINT "integrations_twitch_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."integrations"("user_id") ON DELETE CASCADE;

ALTER TABLE "public"."integrations_discord" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."integrations_discord" DROP CONSTRAINT "integrations_discord_id_fkey";
ALTER TABLE "public"."integrations_discord" DROP CONSTRAINT "integrations_discord_user_id_fkey";
ALTER TABLE "public"."integrations_discord" ADD CONSTRAINT "integrations_discord_user_id_key" UNIQUE ("user_id");
ALTER TABLE "public"."integrations_discord" ADD CONSTRAINT "integrations_discord_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."integrations"("user_id") ON DELETE CASCADE;

-- Rewrite the signup-trigger functions to match: no more threading a shared
-- integration_id through, since the child tables now key off user_id directly.
CREATE OR REPLACE FUNCTION "public"."insert_integration"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.integrations (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in insert_integration: %', SQLERRM;
        RAISE;
END;
$$;

ALTER FUNCTION "public"."insert_integration"("p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."insert_twitch_integration"("p_user_id" "uuid", "provider_data" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.integrations_twitch (
        user_id,
        token_expires_at,
        twitch_username,
        twitch_user_id,
        profile_image_url,
        email,
        broadcaster_type,
        description
    ) VALUES (
        p_user_id,
        (provider_data->>'expires_at')::timestamptz,
        provider_data->>'nickname',
        provider_data->>'provider_id',
        provider_data->>'avatar_url',
        provider_data->>'email',
        provider_data->'custom_claims'->>'broadcaster_type',
        provider_data->'custom_claims'->>'description'
    )
    ON CONFLICT (user_id) DO NOTHING;

    RAISE LOG 'Successfully inserted Twitch integration data';
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error inserting Twitch integration data: %', SQLERRM;
        RAISE;
END;
$$;

ALTER FUNCTION "public"."insert_twitch_integration"("p_user_id" "uuid", "provider_data" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."insert_discord_integration"("p_user_id" "uuid", "provider_data" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.integrations_discord (
        user_id,
        discord_username,
        discord_user_id,
        avatar,
        email,
        server_id,
        roles
    ) VALUES (
        p_user_id,
        provider_data->>'username',
        provider_data->>'user_id',
        provider_data->>'avatar',
        provider_data->>'email',
        provider_data->>'server_id',
        COALESCE(provider_data->'roles', '[]'::jsonb)
    )
    ON CONFLICT (user_id) DO NOTHING;

    RAISE LOG 'Successfully inserted Discord integration data';
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error inserting Discord integration data: %', SQLERRM;
        RAISE;
END;
$$;

ALTER FUNCTION "public"."insert_discord_integration"("p_user_id" "uuid", "provider_data" "jsonb") OWNER TO "postgres";

-- Drop the old overloads (different parameter lists than the ones above).
DROP FUNCTION IF EXISTS "public"."insert_integration"("p_user_id" "uuid", "p_provider_type" "public"."provider_type");
DROP FUNCTION IF EXISTS "public"."insert_twitch_integration"("integration_id" "uuid", "provider_data" "jsonb", "user_id" "uuid");
DROP FUNCTION IF EXISTS "public"."insert_discord_integration"("integration_id" "uuid", "provider_data" "jsonb", "user_id" "uuid");

CREATE OR REPLACE FUNCTION "public"."handle_new_user_integration"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    provider_type_value public.provider_type;
    raw_provider_type TEXT;
BEGIN
    raw_provider_type := NEW.raw_app_meta_data->>'provider';

    BEGIN
        provider_type_value := raw_provider_type::public.provider_type;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Unsupported provider type: %. Must be a valid provider_type ENUM value.', raw_provider_type;
            RETURN NEW;
    END;

    RAISE LOG 'Processing integration for provider type: %', provider_type_value;

    PERFORM public.insert_integration(NEW.id);

    CASE provider_type_value
        WHEN 'twitch' THEN
            PERFORM public.insert_twitch_integration(NEW.id, NEW.raw_user_meta_data);
        WHEN 'discord' THEN
            PERFORM public.insert_discord_integration(NEW.id, NEW.raw_user_meta_data);
    END CASE;

    RETURN NEW;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in handle_new_user_integration: %', SQLERRM;
        RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."handle_new_user_integration"() OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."insert_integration"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_integration"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_integration"("p_user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."insert_twitch_integration"("p_user_id" "uuid", "provider_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_twitch_integration"("p_user_id" "uuid", "provider_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_twitch_integration"("p_user_id" "uuid", "provider_data" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."insert_discord_integration"("p_user_id" "uuid", "provider_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_discord_integration"("p_user_id" "uuid", "provider_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_discord_integration"("p_user_id" "uuid", "provider_data" "jsonb") TO "service_role";
