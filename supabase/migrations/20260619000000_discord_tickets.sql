-- Discord support ticketing. Members open a ticket from a panel button, which
-- spawns a private text channel (author + staff only); staff manage and close
-- it. Two tables: per-guild ticket configuration, and the tickets themselves.
-- Bot-only access via the service-role client, matching the other discord_* tables.

CREATE TYPE "public"."discord_ticket_category" AS ENUM (
    'bug',
    'feature',
    'support',
    'other'
);

ALTER TYPE "public"."discord_ticket_category" OWNER TO "postgres";

CREATE TYPE "public"."discord_ticket_status" AS ENUM (
    'open',
    'closed'
);

ALTER TYPE "public"."discord_ticket_status" OWNER TO "postgres";

-- Per-guild ticketing configuration. Managed via the bot's /ticket setup command,
-- gated by Discord's native "Manage Server" permission.
CREATE TABLE IF NOT EXISTS "public"."discord_ticket_settings" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL,
    "enabled" boolean NOT NULL DEFAULT false,
    "staff_role_id" text,
    "category_id" text,
    "panel_channel_id" text,
    "panel_message_id" text,
    "log_channel_id" text,
    "ticket_counter" integer NOT NULL DEFAULT 0,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_ticket_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discord_ticket_settings_guild_id_unique" UNIQUE ("guild_id")
);

ALTER TABLE "public"."discord_ticket_settings" OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "discord_ticket_settings_updated_at"
    BEFORE UPDATE ON "public"."discord_ticket_settings"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE "public"."discord_ticket_settings" ENABLE ROW LEVEL SECURITY;

-- Only the bot's service-role client reads/writes this table; no anon/authenticated access.
GRANT ALL ON TABLE "public"."discord_ticket_settings" TO "service_role";

-- One row per opened ticket. channel_id is the private text channel created for it.
-- github_issue_number / github_issue_url are populated by a later GitHub sync phase.
CREATE TABLE IF NOT EXISTS "public"."discord_tickets" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL,
    "ticket_number" integer NOT NULL,
    "channel_id" text NOT NULL,
    "opener_discord_user_id" text NOT NULL,
    "opener_user_id" uuid,
    "subject" text NOT NULL,
    "description" text NOT NULL,
    "category" "public"."discord_ticket_category" NOT NULL,
    "status" "public"."discord_ticket_status" NOT NULL DEFAULT 'open',
    "closed_by_discord_user_id" text,
    "closed_at" timestamptz,
    "github_issue_number" integer,
    "github_issue_url" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_tickets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discord_tickets_channel_id_unique" UNIQUE ("channel_id"),
    CONSTRAINT "discord_tickets_guild_number_unique" UNIQUE ("guild_id", "ticket_number"),
    CONSTRAINT "discord_tickets_opener_user_id_fkey" FOREIGN KEY ("opener_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL
);

ALTER TABLE "public"."discord_tickets" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "discord_tickets_guild_idx"
    ON "public"."discord_tickets" USING btree ("guild_id");

CREATE OR REPLACE TRIGGER "discord_tickets_updated_at"
    BEFORE UPDATE ON "public"."discord_tickets"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE "public"."discord_tickets" ENABLE ROW LEVEL SECURITY;

-- Only the bot's service-role client reads/writes this table; no anon/authenticated access.
GRANT ALL ON TABLE "public"."discord_tickets" TO "service_role";

-- Atomically allocates the next per-guild ticket number, so concurrent opens
-- never collide on (guild_id, ticket_number). Creates the settings row on first
-- use if it doesn't exist yet. Mirrors record_guild_member_join's counter pattern.
CREATE OR REPLACE FUNCTION "public"."next_ticket_number"("p_guild_id" text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_ticket_number integer;
BEGIN
    INSERT INTO public.discord_ticket_settings (guild_id, ticket_counter)
    VALUES (p_guild_id, 1)
    ON CONFLICT (guild_id) DO UPDATE SET ticket_counter = discord_ticket_settings.ticket_counter + 1
    RETURNING ticket_counter INTO v_ticket_number;

    RETURN v_ticket_number;
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."next_ticket_number"(text) TO "service_role";
