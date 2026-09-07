import type { Database } from "@repo/supabase";
import type { TimelineEvent } from "@/components/vods/timeline/types";
import { StreamEventType, type Clip } from "@/types/stream-events";
import { getStreamEventDisplayInfo } from "@/lib/utils/stream-events";
import type { TwitchStreamMarker } from "@/types/twitch-video";

/**
 * Adapters between the three shapes the VOD timeline mixes: real
 * `stream_events` rows, Twitch clips, and Twitch markers. Clips and markers are
 * projected onto the event row shape so the timeline only ever sorts one list.
 */

export type StreamEvent = Database["public"]["Tables"]["stream_events"]["Row"];

/**
 * Convert StreamEvent (database format) to TimelineEvent (UI format)
 */
export function toTimelineEvent(event: StreamEvent): TimelineEvent {
  const displayInfo = getStreamEventDisplayInfo(event);
  const offset = event.offset_seconds || 0;

  return {
    id: event.id,
    offset,
    type: event.event_type as StreamEventType,
    label: displayInfo.label,
    details: displayInfo.message,
  };
}

/**
 * Convert a Clip to a pseudo-StreamEvent so it can be displayed in the events panel
 */
export function clipToStreamEvent(clip: Clip): StreamEvent {
  return {
    id: `clip-${clip.id}`,
    created_at: clip.created_at_twitch,
    updated_at: clip.created_at_twitch,
    event_type: "clip",
    provider: "twitch",
    broadcaster_id: clip.broadcaster_id,
    stream_id: clip.video_id ?? "",
    event_data: {
      title: clip.title,
      creator_name: clip.creator_name,
      url: clip.url,
      view_count: clip.view_count,
      duration: clip.duration,
      id: clip.id.toString(),
      twitch_clip_id: clip.twitch_clip_id,
      folder_ids: clip.folder_ids,
      embed_url: clip.embed_url,
    },
    metadata: null,
    status: "completed",
    offset_seconds: clip.vod_offset ?? 0,
  };
}

/**
 * Convert a TwitchStreamMarker to a pseudo-StreamEvent
 */
export function markerToStreamEvent(marker: TwitchStreamMarker): StreamEvent {
  return {
    id: `marker-${marker.id}`,
    created_at: marker.created_at,
    updated_at: marker.created_at,
    event_type: "marker",
    provider: "twitch",
    broadcaster_id: "",
    stream_id: "",
    event_data: {
      description: marker.description,
      url: marker.url,
    },
    metadata: null,
    status: "completed",
    offset_seconds: marker.position_seconds,
  };
}

/** Drag handle type for clip selection */
