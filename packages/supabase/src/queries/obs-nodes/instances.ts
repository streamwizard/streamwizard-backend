import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";

type DBClient = SupabaseClient<Database>;
import { type ObsNode } from "./nodes";

/** Cloud-OBS container rows: placement, lifecycle, and per-node/per-user reads. */

export type ObsInstance = Database["public"]["Tables"]["obs_instances"]["Row"];
type ObsInstanceInsert = Database["public"]["Tables"]["obs_instances"]["Insert"];
type ObsInstanceUpdate = Database["public"]["Tables"]["obs_instances"]["Update"];

/** Returns the most recent running instance for the given user, or null. */
export async function getUserRunningInstance(client: DBClient, userId: string): Promise<ObsInstance | null> {
  const { data } = await client
    .from("obs_instances")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Returns the most recent instance for the user regardless of status, or null. */
export async function getUserLatestInstance(client: DBClient, userId: string): Promise<ObsInstance | null> {
  const { data } = await client
    .from("obs_instances")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Returns the first linked node that still has instance capacity, or null. */
export async function pickAvailableNode(client: DBClient): Promise<ObsNode | null> {
  const { data: nodes } = await client
    .from("obs_nodes")
    .select("*")
    .eq("status", "linked")
    .order("created_at", { ascending: true });
  if (!nodes?.length) return null;

  for (const node of nodes) {
    const { count } = await client
      .from("obs_instances")
      .select("id", { count: "exact", head: true })
      .eq("node_id", node.id)
      .in("status", ["creating", "running"]);
    if ((count ?? 0) < node.max_instances) return node;
  }
  return null;
}

/** Looks up the node api_url for an instance the calling user owns.
 * Returns null if the instance doesn't exist or belongs to a different user. */
export async function getInstanceNodeApiUrl(
  client: DBClient,
  instanceId: string,
  userId: string,
): Promise<string | null> {
  const { data } = await client
    .from("obs_instances")
    .select("node_id, obs_nodes(api_url)")
    .eq("id", instanceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const node = Array.isArray(data.obs_nodes) ? data.obs_nodes[0] : data.obs_nodes;
  return node?.api_url ?? null;
}

// ── Instance CRUD (used by node-authenticated API endpoints) ─────────────────

export async function listObsInstancesByNode(client: DBClient, nodeId: string): Promise<ObsInstance[]> {
  const { data, error } = await client
    .from("obs_instances")
    .select("*")
    .eq("node_id", nodeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listObsInstancesByUser(client: DBClient, userId: string): Promise<ObsInstance[]> {
  const { data, error } = await client
    .from("obs_instances")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getObsInstanceById(client: DBClient, instanceId: string, userId: string): Promise<ObsInstance | null> {
  const { data } = await client
    .from("obs_instances")
    .select("*")
    .eq("id", instanceId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

/** Single instance by id, scoped to the calling node so one node can never
 * read another node's instance rows. */
export async function getObsInstanceByIdForNode(client: DBClient, instanceId: string, nodeId: string): Promise<ObsInstance | null> {
  const { data } = await client
    .from("obs_instances")
    .select("*")
    .eq("id", instanceId)
    .eq("node_id", nodeId)
    .maybeSingle();
  return data;
}

export async function insertObsInstance(client: DBClient, fields: ObsInstanceInsert): Promise<ObsInstance> {
  const { data, error } = await client.from("obs_instances").insert(fields).select().single();
  if (error) throw error;
  return data;
}

/** Node-scoped update: the WHERE also matches node_id, so a node can only
 * mutate its own rows. Returns null when no such row belongs to the node
 * (nonexistent, or owned by another node) — the route turns that into a 404. */
export async function updateObsInstanceForNode(
  client: DBClient,
  instanceId: string,
  nodeId: string,
  fields: ObsInstanceUpdate,
): Promise<ObsInstance | null> {
  const { data, error } = await client
    .from("obs_instances")
    .update(fields)
    .eq("id", instanceId)
    .eq("node_id", nodeId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateObsInstanceByContainerIdForNode(
  client: DBClient,
  containerId: string,
  nodeId: string,
  fields: ObsInstanceUpdate,
): Promise<ObsInstance | null> {
  const { data } = await client
    .from("obs_instances")
    .update(fields)
    .eq("container_id", containerId)
    .eq("node_id", nodeId)
    .select()
    .maybeSingle();
  return data;
}

/** Applies plan-owned fields (config_template + resource snapshot) to every
 * instance a user owns. Used when their plan changes so the next container start
 * reflects the new plan. Admin/service-role only — RLS is bypassed and ownership
 * is enforced by the user_id predicate here. Returns the updated rows. */
export async function updateObsInstancesByUser(
  client: DBClient,
  userId: string,
  fields: ObsInstanceUpdate,
): Promise<ObsInstance[]> {
  const { data, error } = await client
    .from("obs_instances")
    .update(fields)
    .eq("user_id", userId)
    .select();
  if (error) throw error;
  return data ?? [];
}

/** Node-scoped delete. Returns false when nothing matched (missing, or another
 * node's row), so the caller can answer 404 instead of a silent 200. */
export async function deleteObsInstanceForNode(client: DBClient, instanceId: string, nodeId: string): Promise<boolean> {
  const { data, error } = await client
    .from("obs_instances")
    .delete()
    .eq("id", instanceId)
    .eq("node_id", nodeId)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** True if the user has at least one instance provisioned on this node. Gates
 * node-authenticated, user-scoped reads (e.g. the Twitch stream key) so a node
 * can only act for users it actually hosts. */
export async function userHasInstanceOnNode(client: DBClient, userId: string, nodeId: string): Promise<boolean> {
  const { count, error } = await client
    .from("obs_instances")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("node_id", nodeId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** A user's instances that live on this node — the only ones a node manager
 * can act on locally (it resolves each container_id against its own Docker). */
export async function listObsInstancesByUserOnNode(client: DBClient, userId: string, nodeId: string): Promise<ObsInstance[]> {
  const { data, error } = await client
    .from("obs_instances")
    .select("*")
    .eq("user_id", userId)
    .eq("node_id", nodeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function sumAllocatedVramForNode(client: DBClient, nodeId: string): Promise<number> {
  const { data, error } = await client
    .from("obs_instances")
    .select("vram_allocated_mb")
    .eq("node_id", nodeId)
    .eq("status", "running");
  if (error) throw error;
  return (data ?? []).reduce((sum, r) => sum + r.vram_allocated_mb, 0);
}

export async function countActiveObsInstancesForNode(client: DBClient, nodeId: string): Promise<number> {
  const { count, error } = await client
    .from("obs_instances")
    .select("id", { count: "exact", head: true })
    .eq("node_id", nodeId)
    .in("status", ["creating", "running"]);
  if (error) throw error;
  return count ?? 0;
}

export interface RunningInstanceNode {
  id: string;
  node_id: string | null;
  status: string;
  /** Joined from obs_nodes — where the node's command API lives. */
  apiUrl: string | null;
}

/**
 * The user's running instance plus its node's API URL, in one round trip.
 * Used by processes that issue OBS commands on a streamer's behalf.
 */
export async function getRunningInstanceWithNodeUrl(
  client: DBClient,
  userId: string,
): Promise<{ data: RunningInstanceNode | null; error: { message: string } | null }> {
  const { data, error } = await client
    .from("obs_instances")
    .select("id, node_id, status, obs_nodes(api_url)")
    .eq("user_id", userId)
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!data) return { data: null, error: null };

  return {
    data: {
      id: data.id,
      node_id: data.node_id,
      status: data.status,
      apiUrl: (data.obs_nodes as { api_url?: string } | null)?.api_url ?? null,
    },
    error: null,
  };
}
