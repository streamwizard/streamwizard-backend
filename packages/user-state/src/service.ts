import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase/types/supabase";
import type { UserStateUpdatePayload } from "@repo/types";
import {
  applyUserStateOp,
  getUserStates,
  resetStreamStates as resetStreamStatesRpc,
  selectUserStateDefinitions,
  upsertUserStateDefinition,
  type UserStateEntry,
  type UserStateOpResult,
} from "@repo/supabase/queries/user-states";

type DBClient = SupabaseClient<Database>;

/**
 * The one mutation path for user_states. Every write goes through the
 * apply_user_state_op database function (atomic, applies reset policies) and
 * is then pushed to the owning user's ws room — so a counter changed by a
 * chat command, a widget, or an EventSub handler reaches every open overlay
 * the same way, and the push can't be forgotten by one of the callers.
 *
 * The broadcast transport is injected because each app already has its own:
 * the bot holds a persistent role=bot socket, rest-api and web-overlay POST
 * to ws-server's /internal/broadcast. This package stays transport-free.
 */

export type UserStateBroadcast = (
  userId: string,
  payload: UserStateUpdatePayload
) => void | Promise<void>;

export type UserStateResetPolicy = "never" | "stream" | "daily";

export interface UserStateDefinition {
  key: string;
  resetPolicy: UserStateResetPolicy;
  resetValue: unknown;
  resetGraceSeconds: number;
}

export interface UserStateServiceOptions {
  client: DBClient;
  /** Optional: absent (e.g. editor tooling, tests) means mutations still land, nothing is pushed. */
  broadcast?: UserStateBroadcast;
}

export function createUserStateService({ client, broadcast }: UserStateServiceOptions) {
  async function rpc(
    userId: string,
    key: string,
    op: "get" | "set" | "increment" | "delete",
    value?: unknown
  ): Promise<UserStateUpdatePayload> {
    const { data, error } = await applyUserStateOp(client, userId, key, op, value);
    if (error) throw error;
    const row = data as unknown as UserStateOpResult;
    return { key: row.key, value: row.value ?? null, updatedAt: row.updated_at };
  }

  function push(userId: string, payload: UserStateUpdatePayload): void {
    if (!broadcast) return;
    // Best-effort by design: the DB row is the source of truth and a widget
    // that misses a frame corrects itself on its next read. A push failure
    // must never fail the mutation that already committed.
    void Promise.resolve()
      .then(() => broadcast(userId, payload))
      .catch((error) => {
        console.error("[user-state] broadcast failed", { userId, key: payload.key, error });
      });
  }

  async function mutate(
    userId: string,
    key: string,
    op: "set" | "increment" | "delete",
    value?: unknown
  ): Promise<UserStateUpdatePayload> {
    const payload = await rpc(userId, key, op, value);
    push(userId, payload);
    return payload;
  }

  return {
    /** Read one key. Goes through the op function so a lazy daily reset applies before the read. */
    async get(userId: string, key: string): Promise<unknown> {
      const { value } = await rpc(userId, key, "get");
      return value;
    },

    /**
     * Read everything. Daily-policy keys are touched through the op function
     * first so their lazy reset lands before the bulk select — otherwise a
     * widget loading at 01:00 would see yesterday's counter.
     */
    async getAll(userId: string): Promise<Record<string, unknown>> {
      const dailyKeys = (await definitions(userId))
        .filter((d) => d.resetPolicy === "daily")
        .map((d) => d.key);
      await Promise.all(dailyKeys.map((key) => rpc(userId, key, "get")));
      return getUserStates(client, userId);
    },

    set(userId: string, key: string, value: unknown): Promise<UserStateUpdatePayload> {
      return mutate(userId, key, "set", value);
    },

    /** Sequential per key: each write is its own atomic op + broadcast frame. */
    async setMany(userId: string, entries: UserStateEntry[]): Promise<UserStateUpdatePayload[]> {
      const results: UserStateUpdatePayload[] = [];
      for (const entry of entries) {
        results.push(await mutate(userId, entry.key, "set", entry.value));
      }
      return results;
    },

    increment(userId: string, key: string, delta = 1): Promise<UserStateUpdatePayload> {
      return mutate(userId, key, "increment", delta);
    },

    delete(userId: string, key: string): Promise<UserStateUpdatePayload> {
      return mutate(userId, key, "delete");
    },

    /** Upsert a key's reset configuration. Streamer-level: not reachable from widget tokens. */
    async defineState(
      userId: string,
      key: string,
      config: { resetPolicy: UserStateResetPolicy; resetValue?: unknown; resetGraceSeconds?: number }
    ): Promise<void> {
      const { error } = await upsertUserStateDefinition(client, {
        user_id: userId,
        key,
        reset_policy: config.resetPolicy,
        reset_value: config.resetValue ?? 0,
        reset_grace_seconds: config.resetGraceSeconds ?? 900,
      });
      if (error) throw error;
    },

    getDefinitions: definitions,

    /**
     * Apply the 'stream' reset policy for every configured key. Call from the
     * stream.online handlers BEFORE writing the new sys.* keys — the crash
     * guard inside needs the previous stream's sys.stream_ended_at. Broadcasts
     * one frame per key that actually changed; idempotent across the duplicate
     * bot/rest-api call (the second finds nothing left to reset).
     */
    async resetStreamStates(userId: string): Promise<UserStateUpdatePayload[]> {
      const { data, error } = await resetStreamStatesRpc(client, userId);
      if (error) throw error;
      const rows = (data ?? []) as unknown as UserStateOpResult[];
      const payloads = rows.map((row) => ({
        key: row.key,
        value: row.value ?? null,
        updatedAt: row.updated_at,
      }));
      for (const payload of payloads) push(userId, payload);
      return payloads;
    },
  };

  async function definitions(userId: string): Promise<UserStateDefinition[]> {
    const { data, error } = await selectUserStateDefinitions(client, userId);
    if (error) throw error;
    return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
      key: row.key as string,
      resetPolicy: row.reset_policy as UserStateResetPolicy,
      resetValue: row.reset_value,
      resetGraceSeconds: row.reset_grace_seconds as number,
    }));
  }
}

export type UserStateService = ReturnType<typeof createUserStateService>;
