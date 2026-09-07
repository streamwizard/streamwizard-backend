import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

/**
 * Durable per-user key/value state (see the user_states migration).
 *
 * Keys prefixed `sys.` are server-owned — RLS rejects a user write to them, so
 * only service-role callers (the bot, the rest-api EventSub handlers) may set
 * them. Everything else is the streamer's own.
 *
 * The generated Database types are refreshed by `bun run gen-types`, which
 * needs a running database; until that has been run against a stack carrying
 * this table, the casts below stand in for it.
 */

export interface UserStateRow {
  user_id: string;
  key: string;
  value: unknown;
  updated_at: string;
}

export interface UserStateEntry {
  key: string;
  value: unknown;
}

const TABLE = "user_states" as never;

export async function getUserStates(
  client: DBClient,
  userId: string
): Promise<Record<string, unknown>> {
  const { data, error } = await client
    .from(TABLE)
    .select("key, value")
    .eq("user_id", userId);
  if (error) throw error;

  const out: Record<string, unknown> = {};
  for (const row of (data ?? []) as unknown as UserStateEntry[]) out[row.key] = row.value;
  return out;
}

export async function getUserState(
  client: DBClient,
  userId: string,
  key: string
): Promise<unknown> {
  const { data, error } = await client
    .from(TABLE)
    .select("value")
    .eq("user_id", userId)
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return (data as { value?: unknown } | null)?.value ?? null;
}

export async function setUserState(
  client: DBClient,
  userId: string,
  key: string,
  value: unknown
): Promise<void> {
  await setUserStates(client, userId, [{ key, value }]);
}

/**
 * Upsert several keys at once. Still one statement per row underneath, so no
 * key can clobber another's concurrent write — the batching is about round
 * trips, not atomicity across keys.
 */
export async function setUserStates(
  client: DBClient,
  userId: string,
  entries: UserStateEntry[]
): Promise<void> {
  if (entries.length === 0) return;

  const rows = entries.map((entry) => ({
    user_id: userId,
    key: entry.key,
    value: entry.value,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await client
    .from(TABLE)
    .upsert(rows as never, { onConflict: "user_id,key" });
  if (error) throw error;
}

export async function deleteUserState(
  client: DBClient,
  userId: string,
  key: string
): Promise<void> {
  const { error } = await client.from(TABLE).delete().eq("user_id", userId).eq("key", key);
  if (error) throw error;
}

// ── Reset definitions and the atomic mutation RPCs ───────────────────────────
// Writes go through database functions rather than table updates: they apply
// the key's reset policy and return the resulting row in one atomic step, so
// two callers racing on the same counter can't lose an increment.

const DEFINITIONS_TABLE = "user_state_definitions" as never;

export interface UserStateOpResult {
  key: string;
  value: unknown;
  updated_at: string | null;
}

export async function applyUserStateOp(
  client: DBClient,
  userId: string,
  key: string,
  op: "get" | "set" | "increment" | "delete",
  value?: unknown,
) {
  return client.rpc("apply_user_state_op" as never, {
    p_user_id: userId,
    p_key: key,
    p_op: op,
    p_value: value === undefined ? null : value,
  } as never);
}

/** Applies the 'stream' reset policy to every configured key, returning what changed. */
export async function resetStreamStates(client: DBClient, userId: string) {
  return client.rpc("reset_stream_states" as never, { p_user_id: userId } as never);
}

export async function selectUserStateDefinitions(client: DBClient, userId: string) {
  return client
    .from(DEFINITIONS_TABLE)
    .select("key, reset_policy, reset_value, reset_grace_seconds")
    .eq("user_id", userId);
}

export async function upsertUserStateDefinition(
  client: DBClient,
  definition: {
    user_id: string;
    key: string;
    reset_policy: string;
    reset_value: unknown;
    reset_grace_seconds: number;
  },
) {
  return client
    .from(DEFINITIONS_TABLE)
    .upsert({ ...definition, updated_at: new Date().toISOString() } as never, {
      onConflict: "user_id,key",
    });
}
