-- Discord account-linking table, mirroring integrations_twitch's current
-- shape (encrypted token triplets + profile fields). This completes a
-- table the original init migration already assumed existed via
-- insert_discord_integration(), but never actually created.
CREATE TABLE IF NOT EXISTS "public"."integrations_discord" (
    "id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "discord_user_id" text NOT NULL,
    "discord_username" text NOT NULL,
    "avatar" text,
    "email" text,
    "server_id" text,
    "roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "token_expires_at" timestamptz,
    "access_token_ciphertext" text,
    "access_token_iv" text,
    "access_token_tag" text,
    "refresh_token_ciphertext" text,
    "refresh_token_iv" text,
    "refresh_token_tag" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "integrations_discord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "integrations_discord_discord_user_id_key" UNIQUE ("discord_user_id"),
    CONSTRAINT "integrations_discord_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."integrations"("id") ON DELETE CASCADE,
    CONSTRAINT "integrations_discord_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."integrations_discord" OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "update_integrations_discord_updated_at"
    BEFORE UPDATE ON "public"."integrations_discord"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE "public"."integrations_discord" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integrations_select" ON "public"."integrations_discord" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
CREATE POLICY "integrations_update" ON "public"."integrations_discord" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integrations_discord" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integrations_discord" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integrations_discord" TO "service_role";

-- Fix the dead trigger function to match the real table and the
-- established pattern: insert_twitch_integration only inserts profile
-- fields, never tokens. Tokens get filled in later by the app-side OAuth
-- callback after encryption.
CREATE OR REPLACE FUNCTION "public"."insert_discord_integration"("integration_id" "uuid", "provider_data" "jsonb", "user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.integrations_discord (
        id,
        user_id,
        discord_username,
        discord_user_id,
        avatar,
        email,
        server_id,
        roles
    ) VALUES (
        integration_id,
        user_id,
        provider_data->>'username',
        provider_data->>'user_id',
        provider_data->>'avatar',
        provider_data->>'email',
        provider_data->>'server_id',
        COALESCE(provider_data->'roles', '[]'::jsonb)
    );

    RAISE LOG 'Successfully inserted Discord integration data';
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error inserting Discord integration data: %', SQLERRM;
        RAISE;
END;
$$;
