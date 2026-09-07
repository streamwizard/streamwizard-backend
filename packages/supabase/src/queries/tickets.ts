import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export type DiscordTicketSettings = Database["public"]["Tables"]["discord_ticket_settings"]["Row"];
export type DiscordTicket = Database["public"]["Tables"]["discord_tickets"]["Row"];
export type DiscordTicketCategory = Database["public"]["Enums"]["discord_ticket_category"];

export async function getTicketSettings(client: DBClient, guildId: string): Promise<DiscordTicketSettings | null> {
  const { data, error } = await client.from("discord_ticket_settings").select("*").eq("guild_id", guildId).maybeSingle();

  if (error) throw error;
  return data;
}

type TicketSettingsPatch = Partial<Omit<Database["public"]["Tables"]["discord_ticket_settings"]["Insert"], "guild_id">>;

export async function upsertTicketSettings(client: DBClient, guildId: string, patch: TicketSettingsPatch): Promise<DiscordTicketSettings> {
  const { data, error } = await client
    .from("discord_ticket_settings")
    .upsert({ guild_id: guildId, ...patch }, { onConflict: "guild_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Atomically allocates the next per-guild ticket number (creates the settings
// row on first use). See the next_ticket_number migration.
export async function nextTicketNumber(client: DBClient, guildId: string): Promise<number> {
  const { data, error } = await client.rpc("next_ticket_number", { p_guild_id: guildId });

  if (error) throw error;
  return data;
}

interface CreateTicketInput {
  guildId: string;
  ticketNumber: number;
  channelId: string;
  openerDiscordUserId: string;
  openerUserId: string | null;
  subject: string;
  description: string;
  category: DiscordTicketCategory;
}

export async function createTicket(client: DBClient, input: CreateTicketInput): Promise<DiscordTicket> {
  const { data, error } = await client
    .from("discord_tickets")
    .insert({
      guild_id: input.guildId,
      ticket_number: input.ticketNumber,
      channel_id: input.channelId,
      opener_discord_user_id: input.openerDiscordUserId,
      opener_user_id: input.openerUserId,
      subject: input.subject,
      description: input.description,
      category: input.category,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export type TicketOpenerProfile = Pick<Database["public"]["Tables"]["users"]["Row"], "id" | "name" | "email">;

// The linked StreamWizard account for a ticket opener, when their Discord is
// linked (discord_tickets.opener_user_id → users.id). Lets staff see who the
// opener is in StreamWizard, not just their Discord handle.
export async function getTicketOpenerProfile(client: DBClient, userId: string): Promise<TicketOpenerProfile | null> {
  const { data, error } = await client.from("users").select("id, name, email").eq("id", userId).maybeSingle();

  if (error) throw error;
  return data;
}

export async function getTicketByChannelId(client: DBClient, channelId: string): Promise<DiscordTicket | null> {
  const { data, error } = await client.from("discord_tickets").select("*").eq("channel_id", channelId).maybeSingle();

  if (error) throw error;
  return data;
}

// Claims an unclaimed ticket for a staff member. The `is null` guard makes this
// race-safe: a second claimer updates zero rows and gets null back, rather than
// silently stealing the ticket.
export async function claimTicket(client: DBClient, channelId: string, staffDiscordUserId: string): Promise<DiscordTicket | null> {
  const { data, error } = await client
    .from("discord_tickets")
    .update({ claimed_by_discord_user_id: staffDiscordUserId, claimed_at: new Date().toISOString() })
    .eq("channel_id", channelId)
    .is("claimed_by_discord_user_id", null)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function closeTicket(client: DBClient, channelId: string, closedByDiscordUserId: string): Promise<void> {
  const { error } = await client
    .from("discord_tickets")
    .update({ status: "closed", closed_by_discord_user_id: closedByDiscordUserId, closed_at: new Date().toISOString() })
    .eq("channel_id", channelId);

  if (error) throw error;
}

// Phase 2 (GitHub sync): links a ticket to its created GitHub issue.
export async function setTicketGithubIssue(client: DBClient, channelId: string, issueNumber: number, issueUrl: string): Promise<void> {
  const { error } = await client
    .from("discord_tickets")
    .update({ github_issue_number: issueNumber, github_issue_url: issueUrl })
    .eq("channel_id", channelId);

  if (error) throw error;
}

// The GitHub issues repo is a single fixed repo (env-configured), so the issue
// number alone is enough to find the ticket it belongs to.
export async function getTicketByGithubIssue(client: DBClient, issueNumber: number): Promise<DiscordTicket | null> {
  const { data, error } = await client.from("discord_tickets").select("*").eq("github_issue_number", issueNumber).maybeSingle();

  if (error) throw error;
  return data;
}

// Applies a GitHub issue status change to the ticket. Closing sets
// scheduled_deletion_at (a Supabase cron job deletes the channel once that
// time passes); reopening clears it so the channel survives.
export async function syncTicketStatusFromGithub(
  client: DBClient,
  channelId: string,
  status: "open" | "closed",
  scheduledDeletionAt: string | null
): Promise<void> {
  const { error } = await client
    .from("discord_tickets")
    .update({ status, scheduled_deletion_at: scheduledDeletionAt })
    .eq("channel_id", channelId);

  if (error) throw error;
}

