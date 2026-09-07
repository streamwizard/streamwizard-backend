-- Let a staff member claim a ticket (take ownership of it). Tracked on the
-- ticket row so it's visible in the channel and the close log.
ALTER TABLE "public"."discord_tickets"
    ADD COLUMN IF NOT EXISTS "claimed_by_discord_user_id" text,
    ADD COLUMN IF NOT EXISTS "claimed_at" timestamptz;
