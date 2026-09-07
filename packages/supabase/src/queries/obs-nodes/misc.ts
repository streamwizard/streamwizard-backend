import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";

import type { ObsNodeInstanceDetail } from "./nodes";

type DBClient = SupabaseClient<Database>;

/** Odds and ends the node API needs: the admin check, the Twitch token pair
 *  behind the stream-key endpoint, and the admin UI's instance-with-owner read. */

export async function isUserAdmin(client: DBClient, userId: string): Promise<boolean> {
  const { data } = await client
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

// ── Twitch integration (for stream key endpoint) ──────────────────────────────

export interface TwitchIntegration {
  twitch_user_id: string;
  access_token_ciphertext: string | null;
  access_token_iv: string | null;
  access_token_tag: string | null;
  refresh_token_ciphertext: string | null;
  refresh_token_iv: string | null;
  refresh_token_tag: string | null;
}

export async function getTwitchIntegration(client: DBClient, userId: string): Promise<TwitchIntegration | null> {
  const { data } = await client
    .from("integrations_twitch")
    .select(
      "twitch_user_id, access_token_ciphertext, access_token_iv, access_token_tag, refresh_token_ciphertext, refresh_token_iv, refresh_token_tag",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function updateTwitchTokens(
  client: DBClient,
  userId: string,
  fields: {
    access_token_ciphertext: string;
    access_token_iv: string;
    access_token_tag: string;
    refresh_token_ciphertext: string;
    refresh_token_iv: string;
    refresh_token_tag: string;
  },
): Promise<void> {
  await client.from("integrations_twitch").update(fields).eq("user_id", userId);
}

// ── Instance detail with owner (admin UI) ─────────────────────────────────────

/** Single instance with owner name/email, for the admin-only instance detail
 * page. Same two-query join as listInstancesByNodeWithOwner since
 * obs_instances.user_id has no FK to public.users. */
export async function getInstanceByIdWithOwner(
  client: DBClient,
  instanceId: string,
): Promise<ObsNodeInstanceDetail | null> {
  const { data: instance } = await client
    .from("obs_instances")
    .select("id, user_id, node_id, container_id, container_name, resolution, status, vram_allocated_mb, memory_mb, cpu_quota, shm_size, subscription_id, config_template, storage_quota_mb, used_storage_bytes, created_at, updated_at")
    .eq("id", instanceId)
    .maybeSingle();
  if (!instance) return null;

  const { data: owner } = await client.from("users").select("name, email").eq("id", instance.user_id).maybeSingle();

  return {
    ...instance,
    owner_name: owner?.name ?? null,
    owner_email: owner?.email ?? null,
  };
}

/**
 * Encrypted obs-websocket password columns for one instance. `userId` scopes it
 * to an owner; admin callers omit it. Returns null when the instance doesn't
 * exist — an existing instance with no password set comes back with null fields,
 * which callers report differently.
 */
export async function getInstanceObsWsPasswordFields(
  client: DBClient,
  instanceId: string,
  userId?: string,
): Promise<{ ciphertext: string | null; iv: string | null; tag: string | null } | null> {
  const query = client
    .from("obs_instances")
    .select("obs_ws_password_ciphertext, obs_ws_password_iv, obs_ws_password_tag")
    .eq("id", instanceId);

  const { data, error } = await (userId ? query.eq("user_id", userId) : query).maybeSingle();
  if (error || !data) return null;

  return {
    ciphertext: data.obs_ws_password_ciphertext,
    iv: data.obs_ws_password_iv,
    tag: data.obs_ws_password_tag,
  };
}
