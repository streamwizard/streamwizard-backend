import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export type AlertRuleConfig = Database["public"]["Tables"]["alert_rule_config"]["Row"];
export type AlertRuleConfigUpsert = Database["public"]["Tables"]["alert_rule_config"]["Insert"];

/** Admin-edited overrides of the code rule catalog; a missing row (or NULL
 * column) means the code default applies. The engine re-reads this each tick. */
export async function getAlertRuleConfigs(client: DBClient): Promise<AlertRuleConfig[]> {
  const { data, error } = await client.from("alert_rule_config").select("*");
  if (error) throw new Error(`Couldn't load alert rule config: ${error.message}`);
  return data;
}

export async function upsertAlertRuleConfig(client: DBClient, row: AlertRuleConfigUpsert): Promise<void> {
  const { error } = await client.from("alert_rule_config").upsert(row, { onConflict: "rule_id" });
  if (error) throw new Error(`Couldn't save alert rule config: ${error.message}`);
}

/** Resetting a rule to code defaults = deleting its override row. */
export async function deleteAlertRuleConfig(client: DBClient, ruleId: string): Promise<void> {
  const { error } = await client.from("alert_rule_config").delete().eq("rule_id", ruleId);
  if (error) throw new Error(`Couldn't reset alert rule config: ${error.message}`);
}
