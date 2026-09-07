"use server";

import {
  createOverlayPlaylistClipQuery,
  getClipFolderJunctions,
  pickRandomOverlayClip,
} from "@repo/supabase/queries/clips";
import { getTwitchUserIdByUserIdMaybe } from "@repo/supabase/queries/user";
import type { Json } from "@repo/supabase";
import { slimClipsWidgetItemConfig, type ClipsWidgetItemConfig } from "@repo/ui/overlay";
import {
  buildOverlayClipQuery,
  getTimeWindowDates,
  CLIP_SORT_COLUMNS,
} from "@/lib/overlay-clip-query-builder";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { reportError } from "@repo/sentry";
import { getSignedClipProxyUrl } from "@/actions/twitch";

/** Minimal clip identity for Twitch Helix downloads (broadcaster id from clips row). */
export type PlaylistClip = {
  twitchClipId: string;
  broadcasterId: string;
};

export type OverlayClipForDisplay = PlaylistClip & {
  id: string;
  title: string;
  creator_name: string;
  game_name: string | null;
  created_at_twitch: string;
  view_count: number | null;
  duration: number | null;
};

/**
 * Position in a sequential rotation: the sort column's value on the clip that
 * just played, plus its id as tiebreak. Keyset rather than offset so clips
 * synced mid-stream slot into place instead of shifting everything after them.
 */
export type ClipCursor = {
  sortValue: string | number | null;
  clipId: string;
};

export type NextOverlayClip = {
  clip: OverlayClipForDisplay;
  /** Signed `/api/video` path, already minted — saves the caller a round trip. */
  proxyUrl: string;
  cursor: ClipCursor;
};

type ClipScope =
  | { kind: "folders"; clipTwitchIds: string[] }
  | { kind: "broadcaster"; twitchUserId: string }
  | { kind: "empty" };

const FOLDER_SCOPE_TTL_MS = 60_000;

/**
 * Folder membership barely changes mid-stream, and the widget now resolves scope
 * on every clip transition — without this the junction table gets queried once
 * per clip for the whole broadcast.
 */
const folderScopeCache = new Map<string, { ids: string[]; cachedAt: number }>();

async function getTwitchClipIdsInFolders(
  ownerUserId: string,
  folderIds: string[]
): Promise<{ ok: true; ids: string[] } | { ok: false }> {
  const cacheKey = `${ownerUserId}:${[...folderIds].sort().join(",")}`;
  const cached = folderScopeCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < FOLDER_SCOPE_TTL_MS) {
    return { ok: true, ids: cached.ids };
  }

  const { data, error } = await getClipFolderJunctions(
    supabaseAdmin,
    ownerUserId,
    folderIds
  );

  // A DB failure here silently empties the playlist in OBS — report it,
  // nobody watches a browser source's console.
  if (error) {
    reportError(error, "clips.getTwitchClipIdsInFolders");
    return { ok: false };
  }

  const junctionRows = (data ?? []) as { clip_id: string }[];

  const ids = [...new Set(junctionRows.map((r) => r.clip_id).filter(Boolean))];
  folderScopeCache.set(cacheKey, { ids, cachedAt: Date.now() });

  return { ok: true, ids };
}

/**
 * **Tenant scope:** With **no folders**, we require `clips.user_id = sceneUserId` (same as your
 * library) plus `broadcaster_id = linked Twitch id`. With **folders**, clip IDs come from
 * `clip_folder_junction` already filtered by `sceneUserId`; requiring `clips.user_id` as well often
 * matches zero or one row because junction membership and `clips.user_id` are not always aligned.
 */
async function resolveClipScope(
  sceneUserId: string,
  config: ClipsWidgetItemConfig
): Promise<ClipScope> {
  if (config.folderIds.length > 0) {
    const junction = await getTwitchClipIdsInFolders(sceneUserId, config.folderIds);
    if (!junction.ok || junction.ids.length === 0) return { kind: "empty" };
    return { kind: "folders", clipTwitchIds: junction.ids };
  }

  const twitchUserId = await getTwitchUserIdByUserIdMaybe(
    supabaseAdmin,
    sceneUserId
  );
  if (!twitchUserId) return { kind: "empty" };
  return { kind: "broadcaster", twitchUserId };
}

/** PostgREST `or()` values need quoting — timestamps carry `.`, `:` and `+`. */
function quoteFilterValue(value: string | number): string {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

type ClipRowShape = {
  id: string;
  twitch_clip_id: string;
  broadcaster_id: string;
  title: string;
  creator_name: string;
  game_name: string | null;
  created_at_twitch: string;
  view_count: number | null;
  duration: number | null;
};

function toDisplayClip(row: ClipRowShape): OverlayClipForDisplay {
  return {
    id: row.id,
    twitchClipId: row.twitch_clip_id,
    broadcasterId: row.broadcaster_id,
    title: row.title,
    creator_name: row.creator_name,
    game_name: row.game_name,
    created_at_twitch: row.created_at_twitch,
    view_count: row.view_count,
    duration: row.duration,
  };
}

function cursorFor(
  row: ClipRowShape,
  config: ClipsWidgetItemConfig
): ClipCursor {
  const sortConfig = CLIP_SORT_COLUMNS[config.sort];
  const sortValue = sortConfig
    ? ((row as unknown as Record<string, string | number | null>)[
        sortConfig.column
      ] ?? null)
    : null;
  return { sortValue, clipId: row.id };
}

async function fetchNextSequentialClip(
  sceneUserId: string,
  config: ClipsWidgetItemConfig,
  scope: Exclude<ClipScope, { kind: "empty" }>,
  cursor: ClipCursor | null
): Promise<ClipRowShape | null> {
  const sortConfig = CLIP_SORT_COLUMNS[config.sort];

  const run = async (from: ClipCursor | null) => {
    let query = createOverlayPlaylistClipQuery(supabaseAdmin);
    query =
      scope.kind === "folders"
        ? buildOverlayClipQuery(config, query)
        : buildOverlayClipQuery(config, query, { userId: sceneUserId });

    query =
      scope.kind === "folders"
        ? query.in("twitch_clip_id", scope.clipTwitchIds)
        : query.eq("broadcaster_id", scope.twitchUserId);

    if (from && sortConfig && from.sortValue !== null) {
      const op = sortConfig.ascending ? "gt" : "lt";
      const value = quoteFilterValue(from.sortValue);
      query = query.or(
        `${sortConfig.column}.${op}.${value},and(${sortConfig.column}.eq.${value},id.${op}.${from.clipId})`
      );
    }

    return query.limit(1);
  };

  // A null sort value (nullable view_count) has no expressible successor, so it
  // wraps rather than stalling. Only reachable on rows Twitch never gave a
  // view count for, and it self-corrects on the next clip.
  const useCursor = cursor && cursor.sortValue !== null ? cursor : null;

  const { data, error } = await run(useCursor);
  if (error) {
    reportError(error, "clips.getNextOverlayClip.sequential");
    return null;
  }
  if (data?.length) return data[0] as ClipRowShape;
  if (!useCursor) return null;

  // End of the rotation — start over from the top.
  const { data: wrapped, error: wrapError } = await run(null);
  if (wrapError) {
    reportError(wrapError, "clips.getNextOverlayClip.wrap");
    return null;
  }
  return (wrapped?.[0] as ClipRowShape) ?? null;
}

async function fetchRandomClip(
  sceneUserId: string,
  config: ClipsWidgetItemConfig,
  scope: Exclude<ClipScope, { kind: "empty" }>,
  excludeTwitchClipIds: string[]
): Promise<ClipRowShape | null> {
  const { start, end } = getTimeWindowDates(
    config.timeWindow,
    config.customDateRange
  );

  const { data, error } = await pickRandomOverlayClip(supabaseAdmin, {
    p_user_id: scope.kind === "folders" ? null : sceneUserId,
    p_broadcaster_id: scope.kind === "folders" ? null : scope.twitchUserId,
    p_clip_twitch_ids: scope.kind === "folders" ? scope.clipTwitchIds : null,
    p_game_ids: config.gameIds,
    p_creator_ids: config.creatorIds,
    p_is_featured_only: config.isFeaturedOnly,
    p_min_view_count: config.minViewCount,
    p_start: start ?? null,
    p_end: end ?? null,
    p_exclude_twitch_ids: excludeTwitchClipIds,
  });

  if (error) {
    reportError(error, "clips.getNextOverlayClip.random");
    return null;
  }
  return (data as ClipRowShape | null) ?? null;
}

/**
 * One clip, ready to play. The widget keeps three players in a ring — one
 * showing, one buffered, one loading — so this is called once per transition
 * and never blocks what is on screen.
 *
 * Returns the signed proxy URL alongside the row: minting it needs a Twitch
 * Helix call that the caller would otherwise make as a second round trip.
 *
 * `null` means the filtered set is empty (or the lookup failed) — the widget
 * shows its empty state rather than stalling.
 */
export async function getNextOverlayClip(
  sceneUserId: string,
  config: Json,
  cursor: ClipCursor | null,
  excludeTwitchClipIds: string[]
): Promise<NextOverlayClip | null> {
  const c = slimClipsWidgetItemConfig(config);

  const scope = await resolveClipScope(sceneUserId, c);
  if (scope.kind === "empty") return null;

  let from = cursor;
  const skipped = [...excludeTwitchClipIds];

  // Twitch refuses a download URL for clips it has deleted. Step past a few of
  // those rather than handing the widget a null and letting it stall on the
  // same dead clip every time it asks.
  for (let attempt = 0; attempt < 3; attempt++) {
    const row =
      c.sort === "random"
        ? await fetchRandomClip(sceneUserId, c, scope, skipped)
        : await fetchNextSequentialClip(sceneUserId, c, scope, from);

    if (!row) return null;

    const nextCursor = cursorFor(row, c);

    try {
      const proxyUrl = await getSignedClipProxyUrl(
        row.twitch_clip_id,
        row.broadcaster_id
      );
      return { clip: toDisplayClip(row), proxyUrl, cursor: nextCursor };
    } catch (err) {
      reportError(err, "clips.getNextOverlayClip.downloadUrl");
      from = nextCursor;
      skipped.push(row.twitch_clip_id);
    }
  }

  return null;
}
