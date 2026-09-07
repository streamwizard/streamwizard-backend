"use server";

import { reportError } from "@repo/sentry";

import type { ClipsWidgetConfig } from "@/types/overlays";
import { tryAuthContext } from "@/lib/auth";
import { getTwitchIntegrationByUserId } from "@repo/supabase/queries/user";
import { getClipFolderJunctions, getOverlayClips } from "@repo/supabase/queries/clips";

/**
 * The editor preview only needs enough clips to show the rotation working. The
 * live widget pages the DB one clip at a time and has no pool, so there is no
 * user-facing setting to mirror here.
 */
const PREVIEW_CLIP_SAMPLE = 25;

export interface PreviewClip {
  id: number;
  twitch_clip_id: string;
  title: string;
  broadcaster_id: string;
  broadcaster_name: string;
  creator_name: string;
  game_name: string | null;
  view_count: number | null;
  duration: number | null;
  created_at_twitch: string;
  thumbnail_url: string | null;
}

export async function getPreviewClips(config: ClipsWidgetConfig): Promise<{
  clips: PreviewClip[];
  error: string | null;
}> {
  const ctx = await tryAuthContext();
  if (!ctx) return { clips: [], error: "Unauthorized" };
  const { supabase, user } = ctx;

  const { data: twitchIntegration } = await getTwitchIntegrationByUserId(supabase, user.id);
  const twitchUserId = twitchIntegration?.twitch_user_id ?? null;

  let clipTwitchIds: string[] | undefined;

  if (config.folderIds.length > 0) {
    const { data: junctions } = await getClipFolderJunctions(supabase, user.id, config.folderIds);

    if (junctions && junctions.length > 0) {
      clipTwitchIds = [...new Set(junctions.map((j) => j.clip_id))];
    } else {
      return { clips: [], error: null };
    }
  }

  const { data: clips, error } = await getOverlayClips(
    supabase,
    "id, twitch_clip_id, title, broadcaster_id, broadcaster_name, creator_name, game_name, view_count, duration, created_at_twitch, thumbnail_url",
    {
      gameIds: config.gameIds,
      creatorIds: config.creatorIds,
      isFeaturedOnly: config.isFeaturedOnly,
      minViewCount: config.minViewCount,
      timeWindow: config.timeWindow,
      customDateRange: config.customDateRange,
      sort: config.sort,
      limit: PREVIEW_CLIP_SAMPLE,
      broadcasterTwitchId: config.folderIds.length === 0 ? twitchUserId : null,
      clipTwitchIds,
    }
  );

  if (error) {
    reportError(error, "actions/overlays-preview");
    return { clips: [], error: error.message };
  }

  let result = (clips ?? []) as unknown as PreviewClip[];

  if (config.sort === "random") {
    result = result.sort(() => Math.random() - 0.5);
  }

  return { clips: result, error: null };
}
