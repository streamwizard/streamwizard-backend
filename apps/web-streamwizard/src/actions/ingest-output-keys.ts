"use server";

import { reportError } from "@repo/sentry";

import { randomBytes } from "crypto";
import {
  deleteOutputKey as deleteOutputKeyRow,
  ingestKeyBelongsToUser,
  insertOutputKey,
  rotateOutputKeySecret,
  selectOutputKeys,
} from "@repo/supabase/queries/ingest";
import { tryAuthContext } from "@/lib/auth";
import { createAdminClient } from "@repo/supabase/next/admin";
import { revalidatePath } from "next/cache";
import type { Database } from "@repo/supabase";

export type IngestOutputKey = Database["public"]["Tables"]["ingest_output_keys"]["Row"];

const INGEST_SETTINGS_PATH = "/dashboard/irl/obs";

// The credential an OBS Media Source presents (as its SRT streamid) to pull a
// stream from the ingest output listener. Paired to an incoming key (key_id);
// one incoming stream can have several output keys (one per OBS pull).
function generateOutputKey(): string {
  return randomBytes(32).toString("hex");
}

/** Ownership guard: the incoming key must belong to the caller. */
async function assertOwnsKey(
  adminClient: ReturnType<typeof createAdminClient>,
  keyId: string,
  userId: string,
): Promise<boolean> {
  return ingestKeyBelongsToUser(adminClient, keyId, userId);
}

export async function createOutputKey(
  keyId: string,
  label: string,
): Promise<{ data: IngestOutputKey | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  const { user } = ctx;

  const adminClient = createAdminClient();
  if (!(await assertOwnsKey(adminClient, keyId, user.id))) {
    return { data: null, error: "Stream key not found" };
  }

  const { data, error } = await insertOutputKey(adminClient, {
    user_id: user.id,
    key_id: keyId,
    output_key: generateOutputKey(),
    label: label.trim() || "My OBS Output Key",
  });

  if (error) {
    reportError(error, "actions/ingest-output-keys");
    return { data: null, error: error.message };
  }

  revalidatePath(INGEST_SETTINGS_PATH);
  return { data, error: null };
}

export async function listOutputKeys(
  keyId?: string,
): Promise<{ data: IngestOutputKey[] | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  const { user } = ctx;

  const adminClient = createAdminClient();
  const { data, error } = await selectOutputKeys(adminClient, user.id, keyId);
  if (error) reportError(error, "actions/ingest-output-keys");
  return { data, error: error?.message ?? null };
}

export async function rotateOutputKey(
  id: string,
): Promise<{ data: IngestOutputKey | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  const { user } = ctx;

  const adminClient = createAdminClient();
  const { data, error } = await rotateOutputKeySecret(adminClient, id, user.id, generateOutputKey());

  if (error) {
    reportError(error, "actions/ingest-output-keys");
    return { data: null, error: error.message };
  }

  revalidatePath(INGEST_SETTINGS_PATH);
  return { data, error: null };
}

export async function deleteOutputKey(id: string): Promise<{ error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { error: "Unauthorized" };
  const { user } = ctx;

  const adminClient = createAdminClient();
  const { error } = await deleteOutputKeyRow(adminClient, id, user.id);

  revalidatePath(INGEST_SETTINGS_PATH);
  if (error) reportError(error, "actions/ingest-output-keys");
  return { error: error?.message ?? null };
}
