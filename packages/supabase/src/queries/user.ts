import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export async function getTwitchUserId(client: DBClient): Promise<string | null> {
  const { data } = await client.from("integrations_twitch").select("twitch_user_id").single();
  return data?.twitch_user_id ?? null;
}

export async function getBroadcasterId(client: DBClient): Promise<string> {
  const { data, error } = await client.from("integrations_twitch").select("twitch_user_id").single();
  if (error || !data?.twitch_user_id) throw new Error("Failed to fetch broadcaster ID from database");
  return data.twitch_user_id;
}

export async function getUserChannelId(client: DBClient): Promise<string> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error("User not authenticated");

  const { data: twitchData, error: twitchError } = await client
    .from("integrations_twitch")
    .select("twitch_user_id")
    .eq("user_id", userData.user.id)
    .single();

  if (twitchError || !twitchData) throw new Error("Twitch integration not found");
  return twitchData.twitch_user_id;
}

export async function getUserPreferences(client: DBClient) {
  const { data, error } = await client.from("user_preferences").select("*").single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function getTwitchIntegrationByUserId(client: DBClient, userId: string) {
  return client
    .from("integrations_twitch")
    .select("twitch_user_id")
    .eq("user_id", userId)
    .single();
}

export async function getTwitchUserIdByUserIdMaybe(
  client: DBClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await client
    .from("integrations_twitch")
    .select("twitch_user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.twitch_user_id?.trim()) return null;
  return data.twitch_user_id.trim();
}

export async function updateTwitchTokens(
  client: DBClient,
  userId: string,
  tokens: {
    access_token_ciphertext: string;
    access_token_iv: string;
    access_token_tag: string;
    refresh_token_ciphertext: string;
    refresh_token_iv: string;
    refresh_token_tag: string;
  }
) {
  return client.from("integrations_twitch").update(tokens).eq("user_id", userId);
}

export async function getTwitchIntegrationWithTokenByUserId(client: DBClient, userId: string) {
  return client
    .from("integrations_twitch")
    .select("twitch_user_id, access_token_ciphertext")
    .eq("user_id", userId)
    .single();
}

export async function getAllTwitchIntegrations(client: DBClient) {
  const { data, error } = await client.from("integrations_twitch").select("twitch_user_id, user_id");
  if (error) throw error;
  return data ?? [];
}

export async function getTwitchIntegrationByBroadcasterId(client: DBClient, broadcasterId: string) {
  return client.from("integrations_twitch").select("user_id").eq("twitch_user_id", broadcasterId).single();
}

export async function getDiscordIntegrationByUserId(client: DBClient, userId: string) {
  return client
    .from("integrations_discord")
    .select("discord_user_id, discord_username")
    .eq("user_id", userId)
    .single();
}

export async function getDiscordUserIdByUserIdMaybe(
  client: DBClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await client
    .from("integrations_discord")
    .select("discord_user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.discord_user_id?.trim()) return null;
  return data.discord_user_id.trim();
}

export async function getAllDiscordIntegrations(client: DBClient) {
  const { data, error } = await client.from("integrations_discord").select("discord_user_id, user_id");
  if (error) throw error;
  return data ?? [];
}

export async function linkDiscordIntegration(
  client: DBClient,
  profile: {
    discord_user_id: string;
    discord_username: string;
    avatar: string | null;
    email: string | null;
  }
) {
  const { error } = await client.rpc("link_discord_integration", {
    p_discord_user_id: profile.discord_user_id,
    p_discord_username: profile.discord_username,
    p_avatar: profile.avatar ?? "",
    p_email: profile.email ?? "",
  });

  if (error) throw error;
}

export async function deleteDiscordIntegration(client: DBClient, userId: string) {
  const { error } = await client.from("integrations_discord").delete().eq("user_id", userId);
  if (error) throw error;
}

export async function getUserPreferencesByUserId(client: DBClient, userId: string) {
  const { data, error } = await client.from("user_preferences").select("*").eq("user_id", userId).single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function updateUserPreferences(
  client: DBClient,
  userId: string,
  formData: Omit<Database["public"]["Tables"]["user_preferences"]["Insert"], "user_id">
) {
  const { error } = await client
    .from("user_preferences")
    .upsert({ user_id: userId, ...formData }, { onConflict: "user_id" })
    .eq("user_id", userId)
    .single();

  if (error) throw error;
}
