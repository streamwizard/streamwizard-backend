import type { Database } from "../types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DBClient = SupabaseClient<Database>;

export type QueryStat = Database["public"]["Functions"]["admin_query_stats"]["Returns"][number];

/** Top statements from pg_stat_statements, heaviest total time first.
 * service_role only — the RPC is revoked from anon/authenticated. */
export async function getQueryStats(client: DBClient, limit = 50): Promise<QueryStat[]> {
  const { data, error } = await client.rpc("admin_query_stats", { limit_count: limit });
  if (error) throw new Error(`Couldn't read query stats: ${error.message}`);
  return data;
}
