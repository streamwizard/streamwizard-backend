import { reportError } from "@repo/sentry";
import { supabase, Database } from "@repo/supabase";
import { getTwitchIntegrationByBroadcasterId, getTwitchIntegrationByUserId } from "@repo/supabase/queries/user";
import { getClipSync, upsertClipSync, startClipSync, updateClipSyncStatus } from "@repo/supabase/queries/sync";
import { upsertClips } from "@repo/supabase/queries/clips";
import { getVodsByVideoIds } from "@repo/supabase/queries/vods";
import type { TwitchApi } from "@repo/twitch-api";

/**
 * Syncs Twitch clips for a given broadcaster_id.
 * This function can be called from multiple endpoints.
 * @param broadcaster_id - The Twitch broadcaster/user ID to sync clips for
 * @param TwitchAPI - The TwitchApi instance to use for API calls
 * @param options - Optional configuration
 * @param options.skipRecentCheck - Skip the 1-hour check for recent syncs (default: false)
 * @returns The total number of clips synced, or null if sync was skipped
 */
export async function syncTwitch(broadcaster_id: string, TwitchAPI: TwitchApi, options: { skipRecentCheck?: boolean } = {}): Promise<{ clipsCount: number } | { skipped: true; lastSync: string }| null> {
  // Look up the user from the broadcaster_id
  const { data: user, error: userError } = await getTwitchIntegrationByBroadcasterId(supabase, broadcaster_id);

  if (userError || !user) {
    throw new Error(`User not found for broadcaster_id: ${broadcaster_id}`);
  }

  // Check if the last sync was more than an hour ago (unless skipRecentCheck is true)
  const lastSync = await getClipSync(supabase, user.user_id);

  const now = new Date();
  if (!options.skipRecentCheck && lastSync && lastSync.last_sync) {
    const lastSyncDate = new Date(lastSync.last_sync);
    const diffTime = Math.abs(now.getTime() - lastSyncDate.getTime());
    const diffHours = diffTime / (1000 * 60 * 60);

    if (diffHours < 1 && lastSync.sync_status === "completed") {
      console.log("last sync was less than an hour ago, skipping sync");
      return { skipped: true, lastSync: lastSync.last_sync };
    }
  }

  // Create a new sync or update existing one
  if (lastSync) {
    await startClipSync(supabase, user.user_id, now.toISOString());
  } else {
    await upsertClipSync(supabase, user.user_id, now.toISOString());
  }

  try {
    // Start the sync
    const totalClips = await syncTwitchClips(user.user_id, TwitchAPI);

    // Mark as completed
    await updateClipSyncStatus(supabase, user.user_id, "completed", totalClips);

    return { clipsCount: totalClips };
  } catch (error) {
    console.error("Sync failed:", error);
    // Mark as failed
    await updateClipSyncStatus(supabase, user.user_id, "failed");
    throw error;
  }
}

export async function syncTwitchClips(user_id: string, TwitchAPI: TwitchApi) {
  let hasMoreClips = true;
  let cursor: string | undefined;
  let totalClips = 0;
  let iterationCount = 0;
  const MAX_ITERATIONS = 1000; // Safety limit: max 100,000 clips (1000 * 100)
  const seenCursors = new Set<string | undefined>(); // Track cursors to detect infinite loops

  const { data: integration, error } = await getTwitchIntegrationByUserId(supabase, user_id);

  if (error || !integration || !integration.twitch_user_id) {
    // The throw below replaces the Supabase error with a generic message, so
    // report the original first or the actual cause never leaves this frame.
    if (error) reportError(error, "sync-twitch.integration-lookup", { user_id });
    throw new Error("Twitch integration not found for user");
  }

  console.log("Starting sync for user:", user_id);
  // loop until there are no more clips
  while (hasMoreClips) {
    // Safety check: prevent infinite loops
    if (iterationCount >= MAX_ITERATIONS) {
      console.warn(`Sync stopped at ${MAX_ITERATIONS} iterations (${totalClips} clips synced). Possible infinite loop detected.`);
      break;
    }

    // Safety check: detect duplicate cursors (infinite loop protection)
    if (seenCursors.has(cursor)) {
      console.warn(`Duplicate cursor detected: ${cursor}. Stopping sync to prevent infinite loop.`);
      break;
    }
    seenCursors.add(cursor);

    iterationCount++;

    try {
      const clipsResponse = await fetchAndFormatTwitchClips(integration.twitch_user_id, TwitchAPI, cursor);

      if (!clipsResponse) {
        break;
      }

      const { clips, pagination } = clipsResponse;

      if (!clips.length) {
        break;
      }

      // format the clips for the database
      const formattedClips = await formatClipsForDB(clips, user_id);

      // upsert the clips into the database
      await upsertClips(supabase, formattedClips);

      // increment the total number of clips
      totalClips += clips.length;
      cursor = pagination!.cursor;
      hasMoreClips = !!cursor;

      // Clear the formatted clips array reference to help GC
      // (formattedClips will be garbage collected after upsert completes)
    } catch (error) {
      console.error(`Error during clip sync iteration ${iterationCount}:`, error);
      throw error;
    }
  }

  // Clear the Set to free memory
  seenCursors.clear();

  console.log("Sync completed for user:", user_id);

  // return the total number of clips
  return totalClips;
}

export async function fetchAndFormatTwitchClips(broadcasterId: string, TwitchAPI: TwitchApi, cursor?: string) {
  // total number of clips to fetch
  const batchSize = 100;

  // fetch the clips
  const res = await TwitchAPI.clips.getClips({
    broadcaster_id: broadcasterId,
    first: batchSize,
    after: cursor,
  });

  // return the clips and pagination
  return {
    clips: res.data,
    pagination: res.pagination,
  };
}

export type TwitchClip = {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_id: string;
  broadcaster_name: string;
  creator_id: string;
  creator_name: string;
  video_id: string;
  game_id: string;
  language: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
  vod_offset: number | null;
  is_featured: boolean;
};

async function getExistingVodVideoIds(videoIds: string[]): Promise<Set<string>> {
  if (!videoIds.length) {
    return new Set();
  }

  return getVodsByVideoIds(supabase, videoIds);
}

// format the clips for the database
export async function formatClipsForDB(clips: TwitchClip[], userId: string): Promise<Database["public"]["Tables"]["clips"]["Insert"][]> {
  const uniqueVideoIds = [...new Set(clips.map((clip) => clip.video_id).filter((videoId): videoId is string => !!videoId))];
  const existingVodVideoIds = await getExistingVodVideoIds(uniqueVideoIds);

  return clips.map((clip) => ({
    twitch_clip_id: clip.id,
    url: clip.url,
    embed_url: clip.embed_url,
    broadcaster_id: clip.broadcaster_id,
    broadcaster_name: clip.broadcaster_name,
    creator_id: clip.creator_id,
    creator_name: clip.creator_name,
    // Keep FK integrity: only persist video_id when the referenced VOD exists.
    video_id: clip.video_id && existingVodVideoIds.has(clip.video_id) ? clip.video_id : null,
    game_id: clip.game_id,
    language: clip.language,
    title: clip.title,
    view_count: clip.view_count,
    created_at_twitch: clip.created_at,
    thumbnail_url: clip.thumbnail_url,
    duration: clip.duration,
    vod_offset: clip.vod_offset,
    is_featured: clip.is_featured,
    user_id: userId,
  }));
}
