-- Remove the last traces of the Minecraft integration from stream_events.
--
-- 20260907140000 dropped the SMP tables, so nothing produces minecraft events
-- any more. The provider CHECK still accepted 'minecraft' and the comments still
-- advertised it, which left the schema describing a feature that no longer
-- exists.
--
-- Existing minecraft rows have to go first: the new CHECK is validated against
-- the table, so it would fail with "check constraint is violated by some row"
-- while any remain. These rows are event history for a removed integration and
-- nothing reads them.

DELETE FROM "public"."stream_events" WHERE "provider" = 'minecraft';

ALTER TABLE "public"."stream_events" DROP CONSTRAINT "stream_events_provider_check";
ALTER TABLE "public"."stream_events" ADD CONSTRAINT "stream_events_provider_check"
    CHECK ("provider" = ANY (ARRAY['twitch'::text, 'streamwizard'::text]));

COMMENT ON TABLE "public"."stream_events" IS 'Stores Twitch and StreamWizard events for analytics and stream monitoring';
COMMENT ON COLUMN "public"."stream_events"."provider" IS 'Event provider: twitch or streamwizard';
