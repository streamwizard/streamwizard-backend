"use server";

import { randomBytes, createHash } from "crypto";
import { assertAdmin } from "@/lib/assert-admin";
import { createAdminClient } from "@repo/supabase/next/admin";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { ingestNodeCapacitySchema } from "@/schemas/ingest-node";
import {
  type IngestNode,
  type IngestNodeCapacity,
  listIngestNodes,
  createIngestNode,
  updateIngestNodeCapacity,
  deleteIngestNode,
  getIngestNodeById,
} from "@repo/supabase/queries/ingest-nodes";

const INGEST_NODES_PATH = "/ingest";
// Shorter than obs-nodes.ts's 30 minutes: the claim response for an ingest
// node includes the raw SUPABASE_SECRET_KEY (full service-role DB access),
// since ingest-control talks to Supabase directly rather than through
// rest-api. A tighter window shrinks the exposure if a claim command leaks.
const CLAIM_TOKEN_TTL_MS = 15 * 60 * 1000;

async function requireAdminContext() {
  await assertAdmin();
  return createAdminClient();
}

function generateClaimToken() {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
}

export async function listIngestNodesAction(): Promise<{ data: IngestNode[] | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }
  return listIngestNodes(adminClient);
}

export async function getIngestNodeAction(id: string): Promise<{ data: IngestNode | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }

  const node = await getIngestNodeById(adminClient, id);
  return { data: node, error: node ? null : "Node not found." };
}

export async function createIngestNodeAction(
  fields: IngestNodeCapacity,
): Promise<{ data: { node: IngestNode; rawToken: string; installCommand: string } | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }

  const parsed = ingestNodeCapacitySchema.safeParse(fields);
  if (!parsed.success) return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { rawToken, tokenHash } = generateClaimToken();
  const { data, error } = await createIngestNode(adminClient, {
    ...parsed.data,
    claim_token_hash: tokenHash,
    claim_token_expires_at: new Date(Date.now() + CLAIM_TOKEN_TTL_MS).toISOString(),
  });

  if (error || !data) return { data: null, error: error ?? "Couldn't create that node." };

  revalidatePath(INGEST_NODES_PATH);
  // No --tailscale-authkey needed here -- rest-api's /claim handler mints a
  // fresh, single-use, tag:ingest-node-scoped key via a Tailscale OAuth
  // client and hands it back in the claim response, so install.sh joins the
  // tailnet automatically with no admin-supplied secret at all.
  const installCommand =
    `curl -fsSL https://raw.githubusercontent.com/streamwizard/ingest-server/main/scripts/install.sh \\\n` +
    `  | sudo bash -s -- --rest-api-url=${env.STREAMWIZARD_API_URL} --token=${rawToken} --start`;
  return { data: { node: data, rawToken, installCommand }, error: null };
}

export async function updateIngestNodeAction(
  id: string,
  fields: IngestNodeCapacity,
): Promise<{ data: IngestNode | null; error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }

  const parsed = ingestNodeCapacitySchema.safeParse(fields);
  if (!parsed.success) return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { data, error } = await updateIngestNodeCapacity(adminClient, id, parsed.data);
  if (error) return { data: null, error };

  revalidatePath(INGEST_NODES_PATH);
  return { data, error: null };
}

export async function deleteIngestNodeAction(id: string): Promise<{ error: string | null }> {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { error: "Forbidden" };
  }

  const { error } = await deleteIngestNode(adminClient, id);
  revalidatePath(INGEST_NODES_PATH);
  return { error };
}
