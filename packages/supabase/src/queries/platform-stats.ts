import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

/**
 * Platform-wide row counts for the admin dashboard. Service-role only — these
 * deliberately ignore RLS, since the point is totals across every user.
 */

type DBClient = SupabaseClient<Database>;

/** Head-only count query: no rows come back over the wire, just the total. */
async function countRows(
  client: DBClient,
  table: keyof Database["public"]["Tables"],
  filter?: { column: string; value: string | boolean },
): Promise<number> {
  const query = client.from(table).select("*", { count: "exact", head: true });
  const { count } = await (filter ? query.eq(filter.column, filter.value) : query);
  return count ?? 0;
}

export interface PlatformStats {
  clips: number;
  clipSyncs: number;
  activeClipSyncs: number;
  failedClipSyncs: number;
  lastClipSyncAt: string | null;
  pendingClips: number;
  clipFolders: number;
  enabledCommands: number;
  customCommands: number;
  overlayScenes: number;
  activeOverlayScenes: number;
  overlayItems: number;
  customWidgets: number;
  approvedLibraryWidgets: number;
  twitchIntegrations: number;
}

export async function getPlatformStats(client: DBClient): Promise<PlatformStats> {
  const [
    clips,
    clipSyncs,
    activeClipSyncs,
    failedClipSyncs,
    lastSyncRow,
    pendingClips,
    clipFolders,
    enabledCommands,
    customCommands,
    overlayScenes,
    activeOverlayScenes,
    overlayItems,
    customWidgets,
    approvedLibraryWidgets,
    twitchIntegrations,
  ] = await Promise.all([
    countRows(client, "clips"),
    countRows(client, "twitch_clip_syncs"),
    countRows(client, "twitch_clip_syncs", { column: "sync_status", value: "syncing" }),
    countRows(client, "twitch_clip_syncs", { column: "sync_status", value: "failed" }),
    client.from("twitch_clip_syncs").select("last_sync").order("last_sync", { ascending: false }).limit(1).maybeSingle(),
    countRows(client, "pending_clips"),
    countRows(client, "clip_folders"),
    countRows(client, "commands", { column: "enabled", value: true }),
    countRows(client, "custom_commands"),
    countRows(client, "overlay_scenes"),
    countRows(client, "overlay_scenes", { column: "is_active", value: true }),
    countRows(client, "overlay_items"),
    countRows(client, "overlay_widgets"),
    countRows(client, "overlay_widget_library_entries", { column: "is_approved", value: true }),
    countRows(client, "integrations_twitch"),
  ]);

  return {
    clips,
    clipSyncs,
    activeClipSyncs,
    failedClipSyncs,
    lastClipSyncAt: lastSyncRow.data?.last_sync ?? null,
    pendingClips,
    clipFolders,
    enabledCommands,
    customCommands,
    overlayScenes,
    activeOverlayScenes,
    overlayItems,
    customWidgets,
    approvedLibraryWidgets,
    twitchIntegrations,
  };
}

export interface LiveStreamerRow {
  broadcaster_id: string;
  broadcaster_name: string | null;
  title: string | null;
  category_name: string | null;
  stream_started_at: string | null;
}

export interface OverviewStats {
  liveStreamers: LiveStreamerRow[];
  /** Latest viewer count per live broadcaster. */
  viewerCounts: Map<string, number>;
  clips: number;
  failedClipSyncs: number;
  activeOverlayScenes: number;
  enabledCommands: number;
}

/** Snapshot for the admin overview dashboard. */
export async function getOverviewStats(client: DBClient): Promise<OverviewStats> {
  const [liveStreamers, clips, failedClipSyncs, activeOverlayScenes, enabledCommands] = await Promise.all([
    client
      .from("broadcaster_live_status")
      .select("broadcaster_id, broadcaster_name, title, category_name, stream_started_at")
      .eq("is_live", true),
    countRows(client, "clips"),
    countRows(client, "twitch_clip_syncs", { column: "sync_status", value: "failed" }),
    countRows(client, "overlay_scenes", { column: "is_active", value: true }),
    countRows(client, "commands", { column: "enabled", value: true }),
  ]);

  const streamers = liveStreamers.data ?? [];
  const viewerCounts = new Map<string, number>();

  if (streamers.length > 0) {
    // Newest first, so the first row seen per broadcaster is their latest count.
    const { data: viewerRows } = await client
      .from("stream_viewer_counts")
      .select("broadcaster_id, viewer_count, recorded_at")
      .in(
        "broadcaster_id",
        streamers.map((s) => s.broadcaster_id),
      )
      .order("recorded_at", { ascending: false });

    for (const row of viewerRows ?? []) {
      if (!viewerCounts.has(row.broadcaster_id)) viewerCounts.set(row.broadcaster_id, row.viewer_count);
    }
  }

  return { liveStreamers: streamers, viewerCounts, clips, failedClipSyncs, activeOverlayScenes, enabledCommands };
}

/** Ids of every node registered in the DB, used to filter metrics down to known nodes. */
export async function selectRegisteredNodeIds(client: DBClient, table: "ingest_nodes" | "obs_nodes") {
  return client.from(table).select("id");
}
