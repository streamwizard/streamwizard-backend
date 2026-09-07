// Deletes Discord ticket channels whose 24h post-GitHub-close grace period has
// elapsed (discord_tickets.scheduled_deletion_at). Scheduled via pg_cron — see
// supabase/migrations/20260621000001_schedule_ticket_deletion_sweep.sql.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;

interface PendingTicket {
  channel_id: string;
  guild_id: string;
  ticket_number: number;
  subject: string;
  category: string;
  opener_discord_user_id: string;
  claimed_by_discord_user_id: string | null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: pending, error } = await supabase
    .from("discord_tickets")
    .select("channel_id, guild_id, ticket_number, subject, category, opener_discord_user_id, claimed_by_discord_user_id")
    .eq("status", "closed")
    .not("scheduled_deletion_at", "is", null)
    .lte("scheduled_deletion_at", new Date().toISOString());

  if (error) {
    console.error("Failed to query pending ticket deletions", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results = await Promise.allSettled((pending as PendingTicket[]).map((ticket) => sweepTicket(supabase, ticket)));

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(`[sweep-ticket-deletions] ${failures.length}/${results.length} failed`, failures);
  }

  return new Response(JSON.stringify({ processed: results.length, failed: failures.length }), {
    headers: { "Content-Type": "application/json" },
  });
});

async function sweepTicket(supabase: ReturnType<typeof createClient>, ticket: PendingTicket): Promise<void> {
  await postLogMessage(ticket);
  await deleteDiscordChannel(ticket.channel_id);

  const { error } = await supabase.from("discord_tickets").update({ scheduled_deletion_at: null }).eq("channel_id", ticket.channel_id);
  if (error) throw error;
}

async function deleteDiscordChannel(channelId: string): Promise<void> {
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
    method: "DELETE",
    headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
  });

  // 404 means the channel is already gone — fine, treat as success.
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete channel ${channelId}: ${response.status} ${await response.text()}`);
  }
}

// Best-effort: posts a closure note to the guild's configured log channel.
// Failure here shouldn't block the channel deletion itself.
async function postLogMessage(ticket: PendingTicket): Promise<void> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: settings } = await supabase
      .from("discord_ticket_settings")
      .select("log_channel_id")
      .eq("guild_id", ticket.guild_id)
      .maybeSingle();

    const logChannelId = (settings as { log_channel_id: string | null } | null)?.log_channel_id;
    if (!logChannelId) return;

    const content = [
      `🗑️ Ticket #${String(ticket.ticket_number).padStart(4, "0")} channel deleted (GitHub issue closure, 24h grace period elapsed).`,
      `**Subject:** ${ticket.subject}`,
      `**Category:** ${ticket.category}`,
      `**Opened by:** <@${ticket.opener_discord_user_id}>`,
      `**Claimed by:** ${ticket.claimed_by_discord_user_id ? `<@${ticket.claimed_by_discord_user_id}>` : "Unclaimed"}`,
    ].join("\n");

    const response = await fetch(`https://discord.com/api/v10/channels/${logChannelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      console.error(`Failed to post deletion log for ticket #${ticket.ticket_number}`, response.status, await response.text());
    }
  } catch (error) {
    console.error(`Failed to post deletion log for ticket #${ticket.ticket_number}`, error);
  }
}
