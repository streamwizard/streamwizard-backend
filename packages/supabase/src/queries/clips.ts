import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";
import { buildFolderHref } from "./clip-folder-utils";

export { buildFolderHref, folderHrefToUrlPath, urlPathToFolderHref } from "./clip-folder-utils";

type DBClient = SupabaseClient<Database>;

interface ClipFolder {
  clipId: string;
  userId: string;
  folderId?: string;
  folderName: string;
}

export async function addClipToFolder(client: DBClient, { clipId, userId, folderId, folderName }: ClipFolder) {
  if (!folderId && folderName) {
    const { data, error } = await client
      .from("clip_folders")
      .insert({ user_id: userId, name: folderName, href: encodeURIComponent(folderName) })
      .select();

    if (error) throw error;
    if (!data[0]) throw new Error("Insert returned no rows");
    folderId = data[0].id;
  }

  const { error } = await client.from("clip_folder_junction").insert({
    clip_id: clipId,
    folder_id: folderId,
    user_id: userId,
  });

  if (error) throw error;
  return { success: true, message: `Clip added to ${folderName}` };
}

export async function removeClipFromFolder(client: DBClient, clipId: string, folderId: string, userId: string) {
  const { error } = await client
    .from("clip_folder_junction")
    .delete()
    .eq("clip_id", clipId)
    .eq("folder_id", folderId)
    .eq("user_id", userId);

  if (error) throw error;
  return { success: true, message: "Clip removed from folder" };
}

/**
 * Folder hrefs are derived from name + parent, so two folders sharing a name
 * under the same parent would collide on href and make one unreachable.
 * Guard against that here (siblings only — same name under different parents is fine).
 */
async function siblingFolderNameExists(
  client: DBClient,
  userId: string,
  name: string,
  parentFolderId: string | null,
  excludeFolderId?: string
): Promise<boolean> {
  let query = client.from("clip_folders").select("id").eq("user_id", userId).eq("name", name);
  query = parentFolderId == null ? query.is("parent_folder_id", null) : query.eq("parent_folder_id", parentFolderId);
  if (excludeFolderId != null) query = query.neq("id", excludeFolderId);

  const { data, error } = await query.limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function createClipFolder(client: DBClient, folderName: string, userId: string, parentFolderId?: string) {
  let parentHref: string | null = null;

  if (parentFolderId) {
    const { data: parent, error: parentError } = await client
      .from("clip_folders")
      .select("href")
      .eq("id", parentFolderId)
      .eq("user_id", userId)
      .single();

    if (parentError || !parent) throw new Error("Parent folder not found");
    parentHref = parent.href;
  }

  if (await siblingFolderNameExists(client, userId, folderName, parentFolderId ?? null)) {
    throw new Error("A folder with this name already exists here.");
  }

  const { data, error } = await client
    .from("clip_folders")
    .insert({
      name: folderName,
      parent_folder_id: parentFolderId ?? null,
      user_id: userId,
      href: buildFolderHref(folderName, parentHref),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function editClipFolder(client: DBClient, folderId: string, folderName: string, userId: string) {
  const { data: folder, error: folderError } = await client
    .from("clip_folders")
    .select("href, parent_folder_id")
    .eq("id", folderId)
    .eq("user_id", userId)
    .single();

  if (folderError || !folder) throw new Error("Folder not found");

  if (await siblingFolderNameExists(client, userId, folderName, folder.parent_folder_id, folderId)) {
    throw new Error("A folder with this name already exists here.");
  }

  let parentHref: string | null = null;
  if (folder.parent_folder_id) {
    const { data: parent, error: parentError } = await client
      .from("clip_folders")
      .select("href")
      .eq("id", folder.parent_folder_id)
      .eq("user_id", userId)
      .single();

    if (parentError || !parent) throw new Error("Parent folder not found");
    parentHref = parent.href;
  }

  const oldHref = folder.href;
  const newHref = buildFolderHref(folderName, parentHref);

  const { error } = await client
    .from("clip_folders")
    .update({ name: folderName, href: newHref })
    .eq("id", folderId)
    .eq("user_id", userId);

  if (error) throw error;

  if (oldHref !== newHref) {
    // Reparent descendant hrefs. We filter in JS rather than with `.like()`:
    // hrefs are encodeURIComponent'd, so names with spaces contain "%20" and
    // the "%"/"_" characters would act as LIKE wildcards and match unrelated
    // folders. A strict prefix match on `${oldHref}/` is exact and safe.
    const { data: allFolders, error: descendantsError } = await client
      .from("clip_folders")
      .select("id, href")
      .eq("user_id", userId);

    if (descendantsError) throw descendantsError;

    const prefix = `${oldHref}/`;
    const descendants = (allFolders ?? []).filter((item) => item.href.startsWith(prefix));

    for (const descendant of descendants) {
      const updatedHref = `${newHref}${descendant.href.slice(oldHref.length)}`;
      const { error: updateError } = await client
        .from("clip_folders")
        .update({ href: updatedHref })
        .eq("id", descendant.id)
        .eq("user_id", userId);

      if (updateError) throw updateError;
    }
  }
}

export async function deleteClipFolder(client: DBClient, folderId: string) {
  const { data: children, error: childrenError } = await client
    .from("clip_folders")
    .select("id")
    .eq("parent_folder_id", folderId);

  if (childrenError) throw childrenError;

  for (const child of children ?? []) {
    await deleteClipFolder(client, child.id);
  }

  const { error } = await client.from("clip_folders").delete().eq("id", folderId);
  if (error) throw error;
}

export async function getClipFolders(client: DBClient, userId: string) {
  return client.from("clip_folders").select("*").eq("user_id", userId);
}

export async function getClipFolderJunctions(client: DBClient, userId: string, folderIds: string[]) {
  return client
    .from("clip_folder_junction")
    .select("clip_id")
    .eq("user_id", userId)
    .in("folder_id", folderIds);
}

/** Columns streamed by OBS overlay playlists (dedupe by `twitch_clip_id` in the app layer). */
export const OVERLAY_PLAYLIST_CLIP_COLUMNS =
  "id, twitch_clip_id, broadcaster_id, title, creator_name, game_name, created_at_twitch, view_count, duration";

export function createOverlayPlaylistClipQuery(client: DBClient) {
  return client.from("clips").select(OVERLAY_PLAYLIST_CLIP_COLUMNS);
}

export interface OverlayClipFilter {
  gameIds: string[];
  creatorIds: string[];
  isFeaturedOnly: boolean;
  minViewCount: number;
  timeWindow: string;
  customDateRange?: { start: string; end: string };
  sort: string;
  /** Row cap. Callers pass a fixed internal value — this is not a user setting. */
  limit: number;
  broadcasterTwitchId?: string | null;
  clipTwitchIds?: string[];
}

export async function getOverlayClips(client: DBClient, selectFields: string, filter: OverlayClipFilter) {
  let query = client.from("clips").select(selectFields);

  if (filter.gameIds.length > 0) query = query.in("game_id", filter.gameIds) as typeof query;
  if (filter.creatorIds.length > 0) query = query.in("creator_id", filter.creatorIds) as typeof query;
  if (filter.isFeaturedOnly) query = query.eq("is_featured", true) as typeof query;
  if (filter.minViewCount > 0) query = query.gte("view_count", filter.minViewCount) as typeof query;

  if (filter.timeWindow !== "all" && filter.timeWindow !== "custom") {
    const daysMap: Record<string, number> = { last7d: 7, last30d: 30, last90d: 90, last365d: 365 };
    const days = daysMap[filter.timeWindow];
    if (days) {
      const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      query = query.gte("created_at_twitch", start.toISOString()) as typeof query;
    }
  } else if (filter.timeWindow === "custom" && filter.customDateRange) {
    if (filter.customDateRange.start) query = query.gte("created_at_twitch", new Date(filter.customDateRange.start).toISOString()) as typeof query;
    if (filter.customDateRange.end) query = query.lte("created_at_twitch", new Date(filter.customDateRange.end).toISOString()) as typeof query;
  }

  if (filter.sort !== "random") {
    const sortMap: Record<string, { column: string; ascending: boolean }> = {
      newest: { column: "created_at_twitch", ascending: false },
      oldest: { column: "created_at_twitch", ascending: true },
      most_viewed: { column: "view_count", ascending: false },
      least_viewed: { column: "view_count", ascending: true },
    };
    const sortConfig = sortMap[filter.sort];
    if (sortConfig) query = query.order(sortConfig.column, { ascending: sortConfig.ascending }) as typeof query;
  }

  query = query.limit(filter.limit) as typeof query;

  if (filter.clipTwitchIds && filter.clipTwitchIds.length > 0) {
    query = query.in("twitch_clip_id", filter.clipTwitchIds) as typeof query;
  } else if (filter.broadcasterTwitchId) {
    query = query.eq("broadcaster_id", filter.broadcasterTwitchId) as typeof query;
  }

  return query;
}

export interface PickRandomOverlayClipParams {
  p_user_id: string | null;
  p_broadcaster_id: string | null;
  p_clip_twitch_ids: string[] | null;
  p_game_ids: string[];
  p_creator_ids: string[];
  p_is_featured_only: boolean;
  p_min_view_count: number;
  p_start: string | null;
  p_end: string | null;
  /** Clips the overlay played recently; ranked last rather than excluded. */
  p_exclude_twitch_ids: string[];
}

type ClipRow = Database["public"]["Tables"]["clips"]["Row"];

/**
 * One random clip from the filtered set. Lives in Postgres because `order by
 * random()` cannot be expressed through PostgREST, and the clips overlay widget
 * fetches a single clip per transition rather than a playlist.
 *
 * Cast because the function post-dates the generated `Database` types; regenerate
 * them (`supabase gen types`) and this can be typed directly.
 */
export async function pickRandomOverlayClip(
  client: DBClient,
  params: PickRandomOverlayClipParams
): Promise<{ data: ClipRow | null; error: unknown }> {
  const rpc = client.rpc as unknown as (
    fn: string,
    args: PickRandomOverlayClipParams
  ) => Promise<{ data: ClipRow[] | null; error: unknown }>;

  const { data, error } = await rpc.call(client, "pick_random_overlay_clip", params);
  return { data: data?.[0] ?? null, error };
}

export async function upsertClips(client: DBClient, clips: Database["public"]["Tables"]["clips"]["Insert"][]) {
  const { error } = await client.from("clips").upsert(clips, { onConflict: "twitch_clip_id", ignoreDuplicates: false });
  if (error) throw error;
}

export async function getLatestClipByUserId(client: DBClient, userId: string) {
  return client
    .from("clips")
    .select("*")
    .eq("user_id", userId)
    .order("created_at_twitch", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function getMostViewedClipByUserId(client: DBClient, userId: string) {
  return client
    .from("clips")
    .select("*")
    .eq("user_id", userId)
    .order("view_count", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function getClipBroadcasterId(client: DBClient, clipId: string, userId: string): Promise<string | null> {
  const { data: ownedRows } = await client
    .from("clips")
    .select("broadcaster_id")
    .eq("twitch_clip_id", clipId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (ownedRows?.[0]?.broadcaster_id) return ownedRows[0].broadcaster_id;

  const { data: anyRows } = await client
    .from("clips")
    .select("broadcaster_id")
    .eq("twitch_clip_id", clipId)
    .order("created_at", { ascending: false })
    .limit(1);

  return anyRows?.[0]?.broadcaster_id ?? null;
}
