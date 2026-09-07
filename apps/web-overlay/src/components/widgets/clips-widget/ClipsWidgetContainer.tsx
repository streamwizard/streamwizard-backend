"use client";

import { useCallback, useMemo } from "react";
import {
  ClipsWidgetRenderer,
  type ClipsWidgetConfig,
  type NextClipResult,
  type ClipRotationCursor,
  DEFAULT_CLIPS_WIDGET_CONFIG,
} from "@repo/ui/overlay";
import type { OverlayWidgetProps } from "@repo/ui/overlay";
import { getNextOverlayClip, type ClipCursor } from "@/actions/clips";
import type { Json } from "@repo/supabase";

function parseCompositeConfig(raw: unknown): ClipsWidgetConfig {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...DEFAULT_CLIPS_WIDGET_CONFIG, ...(raw as Partial<ClipsWidgetConfig>) };
  }
  return { ...DEFAULT_CLIPS_WIDGET_CONFIG };
}

export function ClipsWidgetContainer({ scene, item }: OverlayWidgetProps) {
  const sceneUserId = scene.user_id;

  // item.config is already the composite config (display fields merged server-side by overlay action)
  const config = useMemo(() => parseCompositeConfig(item.config), [item.config]);

  const fetchNextClip = useCallback(
    async (
      cursor: ClipRotationCursor,
      excludeClipIds: string[]
    ): Promise<NextClipResult | null> => {
      try {
        const next = await getNextOverlayClip(
          sceneUserId,
          item.config as unknown as Json,
          (cursor as ClipCursor | null) ?? null,
          excludeClipIds
        );
        if (!next) {
          // Either the filters match nothing, or Twitch refused a download URL
          // for every clip we tried. The server side logs which; from here they
          // look identical.
          console.warn("[clips] getNextOverlayClip returned null", {
            sceneUserId,
            sort: config.sort,
            timeWindow: config.timeWindow,
            hadCursor: cursor != null,
            excludedCount: excludeClipIds.length,
          });
          return null;
        }

        return {
          clip: {
            clipId: next.clip.twitchClipId,
            broadcasterId: next.clip.broadcasterId,
            title: next.clip.title,
            creatorName: next.clip.creator_name,
            gameName: next.clip.game_name,
            createdAtTwitch: next.clip.created_at_twitch,
            viewCount: next.clip.view_count,
            durationSec: next.clip.duration,
          },
          videoUrl: next.proxyUrl,
          cursor: next.cursor,
        };
      } catch (err) {
        // The renderer keeps showing the current clip and asks again on the next
        // transition — a failed fetch must never blank the overlay.
        console.error("[clips] getNextOverlayClip threw", err);
        return null;
      }
    },
    [sceneUserId, item.config, config.sort, config.timeWindow]
  );

  return <ClipsWidgetRenderer config={config} fetchNextClip={fetchNextClip} />;
}
