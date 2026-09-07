"use server";

import { randomUUID } from "crypto";
import { tryAuthContext } from "@/lib/auth";
import { createAdminClient } from "@repo/supabase/next/admin";
import { getUserActiveSubscriptionId } from "@repo/supabase/queries/subscriptions";
import {
  type ObsInstance,
  getInstanceNodeApiUrl,
  getInstanceObsWsPasswordFields,
  getUserRunningInstance,
  getUserLatestInstance,
  pickAvailableNode,
} from "@repo/supabase/queries/obs-nodes";

// All actions below use the admin client so they can join across
// obs_instances and obs_nodes without requiring RLS policies on obs_nodes that
// would expose node data to end users. Ownership is enforced in the query
// predicate (user_id = userId) rather than via RLS.

export async function getMyRunningInstanceAction(): Promise<{ data: ObsInstance | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthenticated" };
  const userId = ctx.user.id;
  const adminClient = createAdminClient();
  const instance = await getUserRunningInstance(adminClient, userId);
  return { data: instance, error: null };
}

// Looks up the node api_url for an instance the calling user owns.
// The api_url must come from a trusted server-side lookup -- the client
// appends a Bearer token to the WebSocket URL, so an attacker-controlled
// URL in the query string would exfiltrate that token to an arbitrary host.
export async function getInstanceNodeApiUrlAction(
  instanceId: string,
): Promise<{ data: { apiUrl: string } | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthenticated" };
  const userId = ctx.user.id;
  const adminClient = createAdminClient();
  const apiUrl = await getInstanceNodeApiUrl(adminClient, instanceId, userId);
  if (!apiUrl) return { data: null, error: "Instance not found or node has no API URL." };
  return { data: { apiUrl }, error: null };
}

export async function getInstanceObsWsPasswordAction(
  instanceId: string,
): Promise<{ data: { password: string } | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthenticated" };
  const userId = ctx.user.id;

  const adminClient = createAdminClient();
  const fields = await getInstanceObsWsPasswordFields(adminClient, instanceId, userId);
  if (!fields) return { data: null, error: "Instance not found." };
  const { ciphertext, iv, tag } = fields;
  if (!ciphertext || !iv || !tag) return { data: null, error: "Password not set on this instance." };

  const { decryptToken } = await import("@repo/supabase/crypto");
  const password = decryptToken(ciphertext, iv, tag);
  return { data: { password }, error: null };
}

/** Returns the user's most recent instance regardless of status (e.g. stopped). */
export async function getMyLatestInstanceAction(): Promise<{ data: ObsInstance | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthenticated" };
  const userId = ctx.user.id;
  const adminClient = createAdminClient();
  const instance = await getUserLatestInstance(adminClient, userId);
  return { data: instance, error: null };
}

/**
 * Picks an available linked node and provisions a new OBS instance for the
 * calling user. Returns the new instance, node API URL, and OBS WS password.
 */
export async function launchMyInstanceAction(options: { resolution?: string; template?: string } = {}): Promise<{
  data: { instance: ObsInstance; apiUrl: string; password: string } | null;
  error: string | null;
}> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthenticated" };
  const { supabase } = ctx;
  const userId = ctx.user.id;

  const adminClient = createAdminClient();

  const [node, subscriptionId] = await Promise.all([
    pickAvailableNode(adminClient),
    getUserActiveSubscriptionId(adminClient, userId, "cloud_obs"),
  ]);

  if (!node?.api_url) return { data: null, error: "No Cloud OBS capacity is available right now. Please try again later." };
  if (!subscriptionId) return { data: null, error: "No active Cloud OBS subscription found." };

  const obsWsPassword = randomUUID().replace(/-/g, "");
  const { encryptToken } = await import("@repo/supabase/crypto");
  const { ciphertext, iv, authTag } = encryptToken(obsWsPassword);

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { data: null, error: "No active session." };

  const res = await fetch(`${node.api_url.replace(/\/$/, "")}/instances`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...options,
      subscription_id: subscriptionId,
      obs_ws_password: obsWsPassword,
      obs_ws_password_ciphertext: ciphertext,
      obs_ws_password_iv: iv,
      obs_ws_password_tag: authTag,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    return { data: null, error: body.error ?? `Failed to launch instance (${res.status})` };
  }

  const instance = (await res.json()) as ObsInstance;
  return { data: { instance, apiUrl: node.api_url, password: obsWsPassword }, error: null };
}
