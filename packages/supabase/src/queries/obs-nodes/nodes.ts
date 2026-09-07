import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";

type DBClient = SupabaseClient<Database>;

/** The OBS node registry: rows, capacity, and the install-time claim flow. */

export type ObsNode = Database["public"]["Tables"]["obs_nodes"]["Row"];

export interface ObsNodeCapacity {
  name: string;
  max_instances: number;
  api_url: string;
}

export interface ObsNodeInstanceOwner {
  id: string;
  user_id: string;
  container_name: string;
  status: string;
  owner_name: string | null;
  owner_email: string | null;
}

export interface ObsNodeInstanceDetail {
  id: string;
  user_id: string;
  node_id: string;
  container_id: string | null;
  container_name: string;
  resolution: string;
  status: string;
  vram_allocated_mb: number;
  memory_mb: number;
  cpu_quota: number;
  shm_size: string;
  subscription_id: string | null;
  config_template: string | null;
  storage_quota_mb: number | null;
  used_storage_bytes: number | null;
  created_at: string;
  updated_at: string;
  owner_name: string | null;
  owner_email: string | null;
}

export interface ObsNodeClaimFields {
  claim_token_hash: string;
  claim_token_expires_at: string;
}

export async function listNodes(client: DBClient): Promise<{ data: ObsNode[] | null; error: string | null }> {
  const { data, error } = await client.from("obs_nodes").select("*").order("created_at", { ascending: false });
  return { data, error: error?.message ?? null };
}

export async function getNodeById(client: DBClient, id: string): Promise<ObsNode | null> {
  const { data } = await client.from("obs_nodes").select("*").eq("id", id).maybeSingle();
  return data;
}

// Postgres unique_violation. obs_nodes.name has a UNIQUE constraint
// (obs_nodes_name_key) since the name doubles as the node's hostname -- two
// nodes sharing one would mean two machines claiming the same hostname.
// Translate the raw constraint-violation message into something an admin
// can act on, rather than surfacing Postgres's internal wording.
function describeNodeError(error: { code?: string; message: string } | null): string | null {
  if (!error) return null;
  if (error.code === "23505") return "A node with this name already exists. Names must be unique.";
  return error.message;
}

export async function createNode(
  client: DBClient,
  fields: ObsNodeCapacity & ObsNodeClaimFields,
): Promise<{ data: ObsNode | null; error: string | null }> {
  const { data, error } = await client
    .from("obs_nodes")
    .insert({ ...fields, status: "pending" })
    .select("*")
    .single();
  return { data, error: describeNodeError(error) };
}

export async function updateNodeCapacity(
  client: DBClient,
  id: string,
  fields: ObsNodeCapacity,
): Promise<{ data: ObsNode | null; error: string | null }> {
  const { data, error } = await client.from("obs_nodes").update(fields).eq("id", id).select("*").single();
  return { data, error: describeNodeError(error) };
}

export async function deleteNode(client: DBClient, id: string): Promise<{ error: string | null }> {
  const { error } = await client.from("obs_nodes").delete().eq("id", id);
  return { error: error?.message ?? null };
}

/** Looks up by hash regardless of status, so an already-linked row from a
 * near-simultaneous replay is still found (lets the claim endpoint return 409
 * instead of a misleading 404). */
export async function claimNodeByTokenHash(client: DBClient, tokenHash: string): Promise<ObsNode | null> {
  const { data } = await client.from("obs_nodes").select("*").eq("claim_token_hash", tokenHash).maybeSingle();
  return data;
}

/** Atomically transitions a pending, unexpired node to linked in one UPDATE,
 * scoped by the same predicates the caller already checked. Under concurrent
 * claims with the same token, only the first UPDATE to acquire the row lock
 * actually matches -- once it commits (nulling claim_token_hash in the same
 * statement), every other concurrent UPDATE re-evaluates the WHERE clause
 * against that committed state and matches zero rows. Returns null if the
 * preconditions (hash match, not already linked, not expired) didn't hold by
 * the time this statement ran; the caller does a separate read-only lookup
 * only to pick the right error status code, never to decide the mutation. */
export interface ObsNodeSelfReportedFields {
  gpu_bus_id: string;
  total_vram_mb?: number;
  ram_total_mb?: number;
  cpu_cores?: number;
  gpu_model?: string;
  storage_total_mb?: number;
  hostname: string;
}

export async function consumeClaimToken(
  client: DBClient,
  tokenHash: string,
  fields: ObsNodeSelfReportedFields,
): Promise<ObsNode | null> {
  const { data } = await client
    .from("obs_nodes")
    .update({
      status: "linked",
      claim_token_hash: null,
      claim_token_expires_at: null,
      ...fields,
    })
    .eq("claim_token_hash", tokenHash)
    .neq("status", "linked")
    .gt("claim_token_expires_at", new Date().toISOString())
    .select("*")
    .maybeSingle();
  return data;
}

/** Instances currently provisioned on a node, joined with their owner's name/email
 * for the admin-only Nodes metrics view (end users never see other owners).
 * obs_instances.user_id has no FK to public.users (only to auth.users), so this
 * is two queries merged in app code rather than a single PostgREST embed. */
export async function listInstancesByNodeWithOwner(
  client: DBClient,
  nodeId: string,
): Promise<ObsNodeInstanceOwner[]> {
  const { data: instances } = await client
    .from("obs_instances")
    .select("id, user_id, container_name, status")
    .eq("node_id", nodeId);

  if (!instances || instances.length === 0) return [];

  const userIds = [...new Set(instances.map((i) => i.user_id))];
  const { data: owners } = await client.from("users").select("id, name, email").in("id", userIds);
  const ownerById = new Map((owners ?? []).map((o) => [o.id, o]));

  return instances.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    container_name: row.container_name,
    status: row.status,
    owner_name: ownerById.get(row.user_id)?.name ?? null,
    owner_email: ownerById.get(row.user_id)?.email ?? null,
  }));
}
