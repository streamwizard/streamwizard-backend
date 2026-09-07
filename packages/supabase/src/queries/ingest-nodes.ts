import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export type IngestNode = Database["public"]["Tables"]["ingest_nodes"]["Row"];

export interface IngestNodeCapacity {
  name: string;
  max_concurrent_sessions: number | null;
  /** Admin-set public FQDN encoders connect to (e.g. ingest-01.streamwizard.org).
   * null when ops hasn't pointed a domain at this box yet. */
  public_hostname: string | null;
}

export interface IngestNodeClaimFields {
  claim_token_hash: string;
  claim_token_expires_at: string;
}

export async function listIngestNodes(client: DBClient): Promise<{ data: IngestNode[] | null; error: string | null }> {
  const { data, error } = await client.from("ingest_nodes").select("*").order("created_at", { ascending: false });
  return { data, error: error?.message ?? null };
}

export async function getIngestNodeById(client: DBClient, id: string): Promise<IngestNode | null> {
  const { data } = await client.from("ingest_nodes").select("*").eq("id", id).maybeSingle();
  return data;
}

export interface IngestNodeHosts {
  /** Admin-set public FQDN encoders connect to, preferred over public_ip when set. */
  public_hostname: string | null;
  /** Public IP encoders push their SRT/SRTLA feed to (fallback when no domain is set). */
  public_ip: string | null;
  /** Tailnet IP a cloud OBS instance pulls the feed from. */
  tailscale_ip: string | null;
}

/** The node users' ingest keys resolve to. v1 runs a single ingest node, so
 * this returns the most recently linked one; when multi-node lands this is the
 * seam to replace with a per-user assignment lookup. */
export async function getActiveIngestNodeHosts(client: DBClient): Promise<IngestNodeHosts | null> {
  const { data } = await client
    .from("ingest_nodes")
    .select("public_hostname, public_ip, tailscale_ip")
    .eq("status", "linked")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// Postgres unique_violation. ingest_nodes.name has a UNIQUE constraint
// (ingest_nodes_name_key) since the name doubles as the node's hostname --
// two nodes sharing one would mean two machines claiming the same hostname.
// Translate the raw constraint-violation message into something an admin
// can act on, rather than surfacing Postgres's internal wording.
function describeIngestNodeError(error: { code?: string; message: string } | null): string | null {
  if (!error) return null;
  if (error.code === "23505") return "A node with this name already exists. Names must be unique.";
  return error.message;
}

export async function createIngestNode(
  client: DBClient,
  fields: IngestNodeCapacity & IngestNodeClaimFields,
): Promise<{ data: IngestNode | null; error: string | null }> {
  const { data, error } = await client
    .from("ingest_nodes")
    .insert({ ...fields, status: "pending" })
    .select("*")
    .single();
  return { data, error: describeIngestNodeError(error) };
}

export async function updateIngestNodeCapacity(
  client: DBClient,
  id: string,
  fields: IngestNodeCapacity,
): Promise<{ data: IngestNode | null; error: string | null }> {
  const { data, error } = await client.from("ingest_nodes").update(fields).eq("id", id).select("*").single();
  return { data, error: describeIngestNodeError(error) };
}

export async function deleteIngestNode(client: DBClient, id: string): Promise<{ error: string | null }> {
  const { error } = await client.from("ingest_nodes").delete().eq("id", id);
  return { error: error?.message ?? null };
}

/** Looks up by hash regardless of status, so an already-linked row from a
 * near-simultaneous replay is still found (lets the claim endpoint return 409
 * instead of a misleading 404). */
export async function claimIngestNodeByTokenHash(client: DBClient, tokenHash: string): Promise<IngestNode | null> {
  const { data } = await client.from("ingest_nodes").select("*").eq("claim_token_hash", tokenHash).maybeSingle();
  return data;
}

export interface IngestNodeSelfReportedFields {
  cpu_cores?: number;
  ram_total_mb?: number;
  storage_total_mb?: number;
  public_ip?: string;
  lan_ip?: string;
  tailscale_ip?: string;
  hostname: string;
  control_secret_ciphertext: string;
  control_secret_iv: string;
  control_secret_tag: string;
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
export async function consumeIngestClaimToken(
  client: DBClient,
  tokenHash: string,
  fields: IngestNodeSelfReportedFields,
): Promise<IngestNode | null> {
  const { data } = await client
    .from("ingest_nodes")
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

// ── Node API keys ────────────────────────────────────────────────────────────

export interface IngestNodeApiKeyFields {
  key_hash: string;
  key_ciphertext: string;
  key_iv: string;
  key_tag: string;
}

/** Stores the SHA-256 hash and AES-256-GCM encrypted form of an ingest node
 *  API key. The hash enables O(1) auth lookup; the ciphertext lets admins
 *  retrieve/rotate the key -- matching the obs_node_api_keys pattern. Not
 *  consumed by anything yet (no ingest-node-authenticated endpoints exist in
 *  v1), written for forward-compat with a future heartbeat/reconcile route. */
export async function insertIngestNodeApiKey(
  client: DBClient,
  nodeId: string,
  fields: IngestNodeApiKeyFields,
): Promise<void> {
  const { error } = await client.from("ingest_node_api_keys").insert({ node_id: nodeId, ...fields });
  if (error) throw error;
}

/** Returns the node_id for the given key hash, or null if not found.
 *  For a future ingestNodeAuth middleware, unused today. */
export async function lookupIngestNodeByApiKeyHash(
  client: DBClient,
  keyHash: string,
): Promise<string | null> {
  const { data } = await client
    .from("ingest_node_api_keys")
    .select("node_id")
    .eq("key_hash", keyHash)
    .maybeSingle();
  return data?.node_id ?? null;
}

/** Self-reported by the node itself once it actually has a Tailscale IP --
 *  at /claim time (deferred-join case) the node hasn't joined the tailnet
 *  yet, since the auth key it needs to join comes back IN the claim
 *  response, so tailscale_ip is unknown until after that response lands. */
export async function updateIngestNodeTailscaleIp(
  client: DBClient,
  id: string,
  tailscaleIp: string,
): Promise<{ data: IngestNode | null; error: string | null }> {
  const { data, error } = await client
    .from("ingest_nodes")
    .update({ tailscale_ip: tailscaleIp })
    .eq("id", id)
    .select("*")
    .single();
  return { data, error: error?.message ?? null };
}
