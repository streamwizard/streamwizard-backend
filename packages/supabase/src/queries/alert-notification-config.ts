import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export type AlertNotificationConfig = Database["public"]["Tables"]["alert_notification_config"]["Row"];
export type AlertNotificationConfigUpsert = Database["public"]["Tables"]["alert_notification_config"]["Insert"];

/** Per-env notification routing (addresses + severity policy, never tokens).
 * Missing row = code defaults; the engine re-reads this each tick. */
export async function getAlertNotificationConfigs(client: DBClient): Promise<AlertNotificationConfig[]> {
  const { data, error } = await client.from("alert_notification_config").select("*");
  if (error) throw new Error(`Couldn't load alert notification config: ${error.message}`);
  return data;
}

export async function upsertAlertNotificationConfig(
  client: DBClient,
  row: AlertNotificationConfigUpsert,
): Promise<void> {
  const { error } = await client.from("alert_notification_config").upsert(row, { onConflict: "env" });
  if (error) throw new Error(`Couldn't save alert notification config: ${error.message}`);
}
