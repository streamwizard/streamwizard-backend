import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";
import { withMetrics } from "./with-metrics";

type DBClient = SupabaseClient<Database>;

const TABLE = "obs_auto_switcher_configs";

export type AutoSwitcherConfigRow = Database["public"]["Tables"]["obs_auto_switcher_configs"]["Row"];
export type AutoSwitcherConfigInsert = Database["public"]["Tables"]["obs_auto_switcher_configs"]["Insert"];

/**
 * Reads a streamer's switcher config.
 *
 * `userId` is optional so an RLS-scoped client (the dashboard, where the
 * policy already pins the row to the signed-in user) can call this without
 * repeating the filter; the service-role client (web-admin) passes it.
 */
export const selectAutoSwitcherConfig = withMetrics(
  TABLE,
  "select",
  async (client: DBClient, userId?: string) => {
    const query = client.from(TABLE).select("*");
    return userId ? query.eq("user_id", userId).maybeSingle() : query.maybeSingle();
  },
);

export const upsertAutoSwitcherConfig = withMetrics(
  TABLE,
  "upsert",
  async (client: DBClient, userId: string, values: Omit<AutoSwitcherConfigInsert, "user_id">) =>
    client
      .from(TABLE)
      .upsert({ user_id: userId, ...values })
      .select()
      .single(),
);

export const updateSceneOverride = withMetrics(
  TABLE,
  "update",
  async (
    client: DBClient,
    userId: string,
    override: {
      override_scene_uuid: string | null;
      override_scene_name: string | null;
      override_expires_at: string | null;
    },
  ) => client.from(TABLE).update(override).eq("user_id", userId).select().maybeSingle(),
);

/** Every streamer with the switcher turned on — the engine's reconcile pass. */
export const selectEnabledAutoSwitcherConfigs = withMetrics(
  TABLE,
  "select",
  async (client: DBClient) => client.from(TABLE).select("*").eq("enabled", true),
);

/**
 * Clears a manual override without reading the row back. The engine only cares
 * whether the write succeeded; the dashboard uses `updateSceneOverride`, which
 * returns the row so it can push the new state to the overlay.
 */
export const clearSceneOverride = withMetrics(
  TABLE,
  "update",
  async (client: DBClient, userId: string) =>
    client
      .from(TABLE)
      .update({ override_scene_uuid: null, override_scene_name: null, override_expires_at: null })
      .eq("user_id", userId),
);
