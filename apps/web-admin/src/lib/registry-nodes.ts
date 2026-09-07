import { supabaseAdmin } from "@repo/supabase/next/admin";
import { selectRegisteredNodeIds } from "@repo/supabase/queries/platform-stats";

/** Node ids still present in the registry. Influx keeps a deleted node's
 * points until they age out of the query range, so the dashboards intersect
 * every per-node series with this set — deleting a node hides it immediately.
 * Returns null when the registry is unreachable; callers then show the
 * unfiltered data rather than a blank dashboard. */
export async function getRegisteredNodeIds(table: "ingest_nodes" | "obs_nodes"): Promise<Set<string> | null> {
  try {
    const { data, error } = await selectRegisteredNodeIds(supabaseAdmin, table);
    if (error) throw new Error(error.message);
    return new Set((data ?? []).map((row) => row.id));
  } catch {
    return null;
  }
}

export function filterToRegistered<T>(rows: T[], ids: Set<string> | null, nodeId: (row: T) => string): T[] {
  return ids === null ? rows : rows.filter((row) => ids.has(nodeId(row)));
}

/** Charts/tables label series by the raw node_id tag (a uuid); swap it for
 * the registry name where known. Run AFTER filterToRegistered — filtering
 * matches on ids. */
export function labelNodes<T extends { nodeId: string }>(rows: T[], names: Map<string, string>): T[] {
  return rows.map((row) => ({ ...row, nodeId: names.get(row.nodeId) ?? row.nodeId }));
}
