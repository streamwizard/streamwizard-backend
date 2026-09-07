-- GitHub issue sync (Phase 2): when a ticket's GitHub issue is closed, we don't
-- delete the Discord channel immediately like a manual close — we give a 24h
-- grace period in case the issue gets reopened. scheduled_deletion_at tracks
-- when the bot's sweep should delete the channel; null means no pending deletion.
ALTER TABLE "public"."discord_tickets"
    ADD COLUMN IF NOT EXISTS "scheduled_deletion_at" timestamptz;

CREATE INDEX IF NOT EXISTS "discord_tickets_pending_deletion_idx"
    ON "public"."discord_tickets" USING btree ("status", "scheduled_deletion_at")
    WHERE "scheduled_deletion_at" IS NOT NULL;
