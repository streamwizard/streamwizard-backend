import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;
export type DiscordCommandPermission = Database["public"]["Tables"]["discord_command_permissions"]["Row"];
export type DiscordGuildSettings = Database["public"]["Tables"]["discord_guild_settings"]["Row"];

export async function getCommandRoles(client: DBClient, guildId: string, commandName: string): Promise<DiscordCommandPermission[]> {
  const { data, error } = await client
    .from("discord_command_permissions")
    .select("*")
    .eq("guild_id", guildId)
    .eq("command_name", commandName);

  if (error) throw error;
  return data ?? [];
}

export async function getGuildCommandPermissions(client: DBClient, guildId: string): Promise<DiscordCommandPermission[]> {
  const { data, error } = await client.from("discord_command_permissions").select("*").eq("guild_id", guildId);

  if (error) throw error;
  return data ?? [];
}

export async function addCommandRole(client: DBClient, guildId: string, commandName: string, roleId: string): Promise<void> {
  const { error } = await client
    .from("discord_command_permissions")
    .upsert({ guild_id: guildId, command_name: commandName, role_id: roleId }, { onConflict: "guild_id,command_name,role_id" });

  if (error) throw error;
}

export async function removeCommandRole(client: DBClient, guildId: string, commandName: string, roleId: string): Promise<void> {
  const { error } = await client
    .from("discord_command_permissions")
    .delete()
    .eq("guild_id", guildId)
    .eq("command_name", commandName)
    .eq("role_id", roleId);

  if (error) throw error;
}

export async function getGuildSettings(client: DBClient, guildId: string): Promise<DiscordGuildSettings | null> {
  const { data, error } = await client.from("discord_guild_settings").select("*").eq("guild_id", guildId).maybeSingle();

  if (error) throw error;
  return data;
}

export async function setWelcomeChannel(client: DBClient, guildId: string, channelId: string): Promise<void> {
  const { error } = await client
    .from("discord_guild_settings")
    .upsert({ guild_id: guildId, welcome_channel_id: channelId }, { onConflict: "guild_id" });

  if (error) throw error;
}

export async function setVerifiedRoleId(client: DBClient, guildId: string, roleId: string): Promise<void> {
  const { error } = await client
    .from("discord_guild_settings")
    .upsert({ guild_id: guildId, verified_role_id: roleId }, { onConflict: "guild_id" });

  if (error) throw error;
}

export async function setWelcomeEnabled(client: DBClient, guildId: string, enabled: boolean): Promise<void> {
  const { error } = await client
    .from("discord_guild_settings")
    .upsert({ guild_id: guildId, welcome_enabled: enabled }, { onConflict: "guild_id" });

  if (error) throw error;
}

// Snapshots the guild's live member count as the member's join number.
// Idempotent: calling it again for the same guild/user returns their original number.
export async function recordGuildMemberJoin(client: DBClient, guildId: string, userId: string, memberCount: number): Promise<number> {
  const { data, error } = await client.rpc("record_guild_member_join", {
    p_guild_id: guildId,
    p_user_id: userId,
    p_member_count: memberCount,
  });

  if (error) throw error;
  return data;
}

export async function getDiscordIntegrationByDiscordUserId(client: DBClient, discordUserId: string) {
  return client.from("integrations_discord").select("user_id, discord_username").eq("discord_user_id", discordUserId).maybeSingle();
}

export type PublicTwitchIntegration = {
  twitch_username: string;
  broadcaster_type: string | null;
  profile_image_url: string | null;
};

// Looks up the public Twitch profile (no tokens/email) linked to the same
// StreamWizard account as the given Discord user, if any.
export async function getPublicTwitchIntegrationByDiscordUserId(
  client: DBClient,
  discordUserId: string
): Promise<PublicTwitchIntegration | null> {
  const { data: discordIntegration, error: discordError } = await client
    .from("integrations_discord")
    .select("user_id")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (discordError) throw discordError;
  if (!discordIntegration) return null;

  const { data: twitchIntegration, error: twitchError } = await client
    .from("integrations_twitch")
    .select("twitch_username, broadcaster_type, profile_image_url")
    .eq("user_id", discordIntegration.user_id)
    .maybeSingle();

  if (twitchError) throw twitchError;
  return twitchIntegration;
}
