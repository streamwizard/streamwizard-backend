"use server";

import { randomBytes, createHash, randomUUID } from "crypto";
import { assertAdmin } from "@/lib/assert-admin";
import { createAdminClient } from "@repo/supabase/next/admin";
import { createClient } from "@repo/supabase/next/server";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { obsNodeCapacitySchema } from "@/schemas/obs-node";
import {
  type ObsNode,
  type ObsInstance,
  type ObsNodeCapacity,
  type ObsNodeInstanceOwner,
  type ObsNodeInstanceDetail,
  listNodes,
  createNode,
  updateNodeCapacity,
  deleteNode,
  listInstancesByNodeWithOwner,
  getNodeById,
  getInstanceByIdWithOwner,
  getInstanceObsWsPasswordFields,
} from "@repo/supabase/queries/obs-nodes";

const NODES_PATH = "/obs";
const CLAIM_TOKEN_TTL_MS = 30 * 60 * 1000;

async function requireAdminContext() {
  await assertAdmin();
  return createAdminClient();
}

function generateClaimToken() {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
}

export async function listNodesAction(): Promise<{ data: ObsNode[] | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }
  return listNodes(adminClient);
}

export async function getNodeAction(id: string): Promise<{ data: ObsNode | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }

  const node = await getNodeById(adminClient, id);
  return { data: node, error: node ? null : "Node not found." };
}

export async function getInstanceAction(
  instanceId: string,
): Promise<{ data: ObsNodeInstanceDetail | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }

  const instance = await getInstanceByIdWithOwner(adminClient, instanceId);
  return { data: instance, error: instance ? null : "Instance not found." };
}

export async function createNodeAction(
  fields: ObsNodeCapacity,
): Promise<{ data: { node: ObsNode; rawToken: string; installCommand: string } | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }

  const parsed = obsNodeCapacitySchema.safeParse(fields);
  if (!parsed.success) return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { rawToken, tokenHash } = generateClaimToken();
  const { data, error } = await createNode(adminClient, {
    ...parsed.data,
    claim_token_hash: tokenHash,
    claim_token_expires_at: new Date(Date.now() + CLAIM_TOKEN_TTL_MS).toISOString(),
  });

  if (error || !data) return { data: null, error: error ?? "Couldn't create that node." };

  revalidatePath(NODES_PATH);
  const installCommand =
    `curl -fsSL https://raw.githubusercontent.com/streamwizard/obs-instance-manager/main/scripts/install.sh \\\n` +
    `  | sudo bash -s -- --rest-api-url=${env.STREAMWIZARD_API_URL} --token=${rawToken} --start`;
  return { data: { node: data, rawToken, installCommand }, error: null };
}

export async function updateNodeAction(
  id: string,
  fields: ObsNodeCapacity,
): Promise<{ data: ObsNode | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }

  const parsed = obsNodeCapacitySchema.safeParse(fields);
  if (!parsed.success) return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { data, error } = await updateNodeCapacity(adminClient, id, parsed.data);
  if (error) return { data: null, error };

  revalidatePath(NODES_PATH);
  return { data, error: null };
}

export async function listNodeInstancesAction(
  nodeId: string,
): Promise<{ data: ObsNodeInstanceOwner[] | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }

  const data = await listInstancesByNodeWithOwner(adminClient, nodeId);
  return { data, error: null };
}

// Looks up a node's api_url server-side rather than trusting a client-supplied
// URL -- the VNC viewer page forwards this token-bearing URL into a
// WebSocket connection, so an attacker-controlled apiUrl in the query string
// would exfiltrate the admin's Supabase access token to an arbitrary host.
export async function getNodeApiUrlAction(
  nodeId: string,
): Promise<{ data: { apiUrl: string } | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }

  const node = await getNodeById(adminClient, nodeId);
  if (!node || !node.api_url) return { data: null, error: "Node not found or has no API URL." };

  return { data: { apiUrl: node.api_url }, error: null };
}

export async function createInstanceAction(
  nodeId: string,
  options: { resolution?: string; template?: string } = {},
): Promise<{ data: ObsInstance | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }

  // Resolve the node's API URL server-side — never trust a client-supplied URL
  // because the fetch below attaches the acting admin's Bearer token.
  const node = await getNodeById(adminClient, nodeId);
  if (!node?.api_url) return { data: null, error: "Node not found or has no API URL." };
  const apiUrl = node.api_url;

  const obsWsPassword = randomUUID().replace(/-/g, "");
  const { encryptToken } = await import("@repo/supabase/crypto");
  const { ciphertext, iv, authTag } = encryptToken(obsWsPassword);

  const supabase = await createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { data: null, error: "No active session." };

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/instances`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...options,
      obs_ws_password: obsWsPassword,
      obs_ws_password_ciphertext: ciphertext,
      obs_ws_password_iv: iv,
      obs_ws_password_tag: authTag,
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { data: null, error: body.error ?? `Failed to create instance (${res.status})` };
  }

  const instance = (await res.json()) as ObsInstance;
  return { data: instance, error: null };
}

// Decrypts an instance's OBS WebSocket password so the admin instance page can
// open an obsws session (scene list for the auto-switcher editor). Admin-only —
// no ownership predicate, authority comes from the role check.
export async function getInstanceObsWsPasswordAdminAction(
  instanceId: string,
): Promise<{ data: { password: string } | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }

  const fields = await getInstanceObsWsPasswordFields(adminClient, instanceId);
  if (!fields) return { data: null, error: "Instance not found." };
  const { ciphertext, iv, tag } = fields;
  if (!ciphertext || !iv || !tag) return { data: null, error: "Password not set on this instance." };

  const { decryptToken } = await import("@repo/supabase/crypto");
  const password = decryptToken(ciphertext, iv, tag);
  return { data: { password }, error: null };
}

export async function deleteNodeAction(id: string): Promise<{ error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { error: "Forbidden" };
  }

  const { error } = await deleteNode(adminClient, id);
  revalidatePath(NODES_PATH);
  return { error };
}
