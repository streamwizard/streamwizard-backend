-- Schedules the sweep-ticket-deletions Edge Function (supabase/functions/sweep-ticket-deletions)
-- to run every 15 minutes via pg_cron, deleting Discord ticket channels whose
-- GitHub-close grace period (discord_tickets.scheduled_deletion_at) has elapsed.
--
-- Requires two Vault secrets to be created once, out-of-band (not via migration,
-- since they're real secrets — set them in the Supabase dashboard or via
-- `select vault.create_secret('<value>', 'project_url')` / `'service_role_key'`):
--   - project_url: e.g. https://<project-ref>.supabase.co
--   - service_role_key: the project's service_role key
-- The Edge Function itself also needs a DISCORD_BOT_TOKEN secret set via
-- `supabase secrets set DISCORD_BOT_TOKEN=...`.

CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";

SELECT cron.schedule(
    'sweep-ticket-deletions',
    '*/15 * * * *',
    $$
    SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/sweep-ticket-deletions',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
        ),
        body := '{}'::jsonb
    ) AS request_id;
    $$
);
