import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Download my data" export. Every table a user owns rows in, paged out in full.
 *
 * Typed against a loose client on purpose: this walks ~18 tables generically,
 * and threading the generated Database union through a dynamic table name buys
 * nothing here — the rows go straight into a JSON blob.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

const PAGE_SIZE = 500;

/** Which column ties a table's rows to the requesting user. */
type OwnerColumn = "user_id" | "channel_id" | "broadcaster_id";

interface ExportSpec {
  /** Key in the exported JSON. */
  key: string;
  table: string;
  ownedBy: OwnerColumn;
  /** Defaults to every column. */
  columns?: string;
}

const EXPORT_TABLES: ExportSpec[] = [
  { key: "preferences", table: "user_preferences", ownedBy: "user_id" },
  {
    key: "twitch_integration",
    table: "integrations_twitch",
    ownedBy: "user_id",
    columns:
      "twitch_user_id, twitch_username, broadcaster_type, description, profile_image_url, email, created_at, updated_at",
  },
  { key: "overlay_scenes", table: "overlay_scenes", ownedBy: "user_id" },
  { key: "widgets", table: "overlay_widgets", ownedBy: "user_id" },
  { key: "widget_library", table: "overlay_widget_library_entries", ownedBy: "user_id" },
  { key: "clips", table: "clips", ownedBy: "user_id" },
  { key: "clip_folders", table: "clip_folders", ownedBy: "user_id" },
  { key: "clip_folder_junction", table: "clip_folder_junction", ownedBy: "user_id" },
  { key: "twitch_clip_syncs", table: "twitch_clip_syncs", ownedBy: "user_id" },
  { key: "commands", table: "commands", ownedBy: "channel_id" },
  { key: "vods", table: "vods", ownedBy: "broadcaster_id" },
  { key: "stream_events", table: "stream_events", ownedBy: "broadcaster_id" },
  { key: "stream_viewer_counts", table: "stream_viewer_counts", ownedBy: "broadcaster_id" },
  { key: "irl_geo_track", table: "irl_geo_track", ownedBy: "user_id" },
  { key: "feedback", table: "feedback", ownedBy: "user_id" },
  { key: "testimonials", table: "testimonials", ownedBy: "user_id" },
];

/**
 * Throws on a failed page instead of breaking out: silently stopping used to
 * hand the user a truncated export presented as complete. Callers report the
 * throw and surface it as a retryable error.
 */
async function fetchAllPages(
  client: AnyClient,
  spec: ExportSpec,
  ownerValue: string,
): Promise<unknown[]> {
  const rows: unknown[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from(spec.table)
      .select(spec.columns ?? "*")
      .eq(spec.ownedBy, ownerValue)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`data export query failed for "${spec.table}" at offset ${from}`, { cause: error });
    }
    if (!data) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

/**
 * Collects everything the user owns. Rejects if any table fails — a partial
 * export that looks complete is worse than none.
 */
export async function exportUserData(
  client: AnyClient,
  owner: { userId: string; broadcasterId: string },
): Promise<Record<string, unknown>> {
  const ownerValueFor = (ownedBy: OwnerColumn) =>
    ownedBy === "user_id" ? owner.userId : owner.broadcasterId;

  const profilePromise = client
    .from("users")
    .select("name, email, avatar_url, created_at")
    .eq("id", owner.userId)
    .single();
  const tablesPromise = Promise.all(
    EXPORT_TABLES.map((spec) => fetchAllPages(client, spec, ownerValueFor(spec.ownedBy))),
  );

  const [profile, tables] = await Promise.all([profilePromise, tablesPromise]);

  const exportData: Record<string, unknown> = {};
  if (profile.data) exportData.profile = profile.data;

  EXPORT_TABLES.forEach((spec, index) => {
    const rows = tables[index] ?? [];
    if (rows.length) exportData[spec.key] = rows;
  });

  return exportData;
}
