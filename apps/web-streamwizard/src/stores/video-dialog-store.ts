"use client";

import { create } from "zustand";
import { toast } from "sonner";
import { getStreamData, createClipFromVOD, getStreamMarkers, createStreamMarker } from "@/actions/twitch/vods";
import { StreamEventType } from "@/types/stream-events";
import { openTwitchUrl } from "@/lib/utils/open-twitch-url";
import { parseDuration } from "@/types/twitch-video";
import { clipToStreamEvent, markerToStreamEvent, toTimelineEvent } from "./video-dialog/event-mappers";
import { initialState } from "./video-dialog/initial-state";
import type { DragHandle, VideoPlayerStore } from "./video-dialog/types";
import type { StreamEvent } from "./video-dialog/event-mappers";
import type { TimelineSegment } from "@/components/vods/timeline/types";

export type {
  DragHandle,
  DragStartInfo,
  VideoPlayerState,
  VideoPlayerActions,
  VideoPlayerStore,
} from "./video-dialog/types";

export const useVideoPlayerStore = create<VideoPlayerStore>((set, get) => ({
  ...initialState,
  // Dialog actions
  setVideo: (video) => set({ video }),

  // Player actions
  setPlayer: (player) => set({ player }),

  setPlayerReady: (ready) => set({ isPlayerReady: ready }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setIsMuted: (muted) => set({ isMuted: muted }),

  setCurrentTime: (time) => set({ currentTime: time }),

  incrementPlayerKey: () => set((state) => ({ playerKey: state.playerKey + 1 })),

  // Playback controls
  play: () => {
    const { player, isPlayerReady } = get();
    if (player && isPlayerReady) {
      player.play();
    }
  },

  pause: () => {
    const { player, isPlayerReady } = get();
    if (player && isPlayerReady) {
      player.pause();
    }
  },

  togglePlay: () => {
    const { isPlaying } = get();
    if (isPlaying) {
      get().pause();
    } else {
      get().play();
    }
  },

  toggleMute: () => {
    const { player, isMuted, isPlayerReady } = get();
    if (player && isPlayerReady) {
      const newMuted = !isMuted;
      player.setMuted(newMuted);
      set({ isMuted: newMuted });
    }
  },

  seek: (seconds) => {
    const { player, isPlayerReady } = get();
    if (player && isPlayerReady) {
      player.seek(seconds);
      set({ currentTime: seconds });
    }
  },

  // Event actions
  setEvents: (events) => set({ events }),
  setFilteredEvents: (events) => set({ filteredEvents: events }),
  setIsLoadingEvents: (loading) => set({ isLoadingEvents: loading }),

  // Segment actions
  setMutedSegments: (mutedSegments) => {
    const { segments: currentSegments } = get();
    const newSegments = new Map(currentSegments);
    if (mutedSegments && mutedSegments.length > 0) {
      newSegments.set(
        "muted",
        mutedSegments.map((s) => ({
          type: "muted" as const,
          offset: s.offset,
          duration: s.duration,
          label: "Muted",
        })),
      );
    } else {
      newSegments.delete("muted");
    }
    set({ segments: newSegments });
  },
  fetchEvents: async (videoId) => {
    set({ isLoadingEvents: true });
    try {
      // Fetch stream data and markers in parallel
      const [streamDataResult, markersResult] = await Promise.all([getStreamData(videoId), getStreamMarkers(videoId)]);

      const rawEvents = streamDataResult.success ? (streamDataResult.events ?? []) : [];
      const clips = streamDataResult.success ? (streamDataResult.clips ?? []) : [];
      const markers = markersResult.success ? (markersResult.markers ?? []) : [];

      // Convert clips and markers to pseudo-StreamEvents and merge with real events
      const clipEvents = clips.map(clipToStreamEvent);
      const markerEvents = markers.map(markerToStreamEvent);
      const allEvents = [...rawEvents, ...clipEvents, ...markerEvents].sort((a, b) => (a.offset_seconds ?? 0) - (b.offset_seconds ?? 0));

      // Extract ad break segments from events
      const adBreakSegments: TimelineSegment[] = rawEvents
        .filter((e) => e.event_type === "channel.ad_break.begin" && e.event_data)
        .map((e) => {
          const data = e.event_data as Record<string, unknown>;
          return {
            type: "ad_break" as const,
            offset: e.offset_seconds ?? 0,
            duration: (data.duration_seconds as number) ?? 60,
            label: "Ad Break",
          };
        });

      const { selectedEventTypes, segments: currentSegments } = get();
      const filtered = allEvents.filter((event: StreamEvent) => selectedEventTypes.has(event.event_type));
      const timeline = filtered.map(toTimelineEvent);

      // Merge ad break segments into existing segments map (preserve muted segments)
      const newSegments = new Map(currentSegments);
      newSegments.set("ad_break", adBreakSegments);

      set({ events: allEvents, clips, filteredEvents: filtered, timelineEvents: timeline, segments: newSegments });
    } catch (error) {
      console.error("Failed to fetch stream data:", error);
      set({ events: [], clips: [], filteredEvents: [], timelineEvents: [], segments: new Map() });
    } finally {
      set({ isLoadingEvents: false });
    }
  },

  seekToEvent: (eventId: string) => {
    const { events, seek } = get();
    const event = events.find((e) => e.id === eventId);
    if (event) {
      seek(event.offset_seconds as number);
    }
  },

  toggleEventType: (type: string) => {
    const { selectedEventTypes, events } = get();
    const next = new Set(selectedEventTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    // Update filtered events and timeline events
    const filtered = events.filter((event) => next.has(event.event_type));
    const timeline = filtered.map(toTimelineEvent);
    set({ selectedEventTypes: next, filteredEvents: filtered, timelineEvents: timeline });
  },

  selectAllEventTypes: () => {
    const { events } = get();
    const allTypes = new Set<string>([
      "channel.follow",
      "channel.subscribe",
      "channel.subscription.message",
      "channel.subscription.gift",
      "channel.raid",
      "channel.cheer",
      "channel.ban",
      "channel.unban",
      "channel.shoutout.create",
      "channel.shoutout.receive",
      "channel.channel_points_custom_reward_redemption.add",
      "channel.moderator.add",
      "channel.moderator.remove",
      "channel.ad_break.begin",
      "obs.scene_switch",
      "clip",
      "marker",
    ]);
    // Update filtered events and timeline events to include all
    const filtered = events.filter((event) => allTypes.has(event.event_type));
    const timeline = filtered.map(toTimelineEvent);
    set({ selectedEventTypes: allTypes, filteredEvents: filtered, timelineEvents: timeline });
  },

  deselectAllEventTypes: () => {
    set({ selectedEventTypes: new Set<string>(), filteredEvents: [], timelineEvents: [] });
  },

  // Clip creation actions
  startClipCreation: (atOffset?: number) => {
    const { video, currentTime, isPlayerReady, seek } = get();
    if (!video || !isPlayerReady) return;

    const totalDuration = parseDuration(video.duration);
    const center = atOffset ?? currentTime;
    const start = Math.max(0, center - 15);
    const end = Math.min(totalDuration, center + 15);

    set({
      isCreatingClip: true,
      clipStartTime: start,
      clipEndTime: end,
    });

    // Seek to clip start
    seek(start);
  },

  cancelClipCreation: () => {
    set({
      isCreatingClip: false,
      clipTitle: "",
    });
  },

  setClipTitle: (title) => set({ clipTitle: title }),

  setClipStartTime: (time) => set({ clipStartTime: time }),

  setClipEndTime: (time) => set({ clipEndTime: time }),

  setClipSelection: (start, end) => {
    const { seek } = get();
    set({
      clipStartTime: start,
      clipEndTime: end,
    });

    seek(start);
  },

  saveClip: async () => {
    const { video, clipTitle, clipStartTime, clipEndTime } = get();

    if (!video?.id || !clipTitle.trim()) {
      return { success: false, error: "Missing video ID or clip title" };
    }

    set({ isSubmittingClip: true });

    const clipPromise = (async () => {
      // Calculate duration and vod_offset
      // Note: vod_offset is where the clip ENDS
      // The clip will start at (vod_offset - duration) and end at vod_offset
      const duration = clipEndTime - clipStartTime;
      const vod_offset = clipEndTime;

      const result = await createClipFromVOD({
        vodId: video.id,
        vod_offset: vod_offset,
        duration: duration,
        title: clipTitle,
      });

      if (result.success && result.data) {
        // Reset clip creation state on success and refetch events
        get().cancelClipCreation();
        const videoId = video.id;
        // Refetch events in background so the new clip appears
        get().fetchEvents(videoId);
        return {
          success: true as const,
          editUrl: result.data.editUrl,
          clipId: result.data.clipId,
        };
      } else {
        throw new Error(!result.success ? result.error : "Failed to create clip");
      }
    })();

    toast.promise(clipPromise, {
      loading: "Creating clip...",
      success: (data) => ({
        message: "Clip created successfully!",
        action: data.editUrl
          ? {
              label: "View Clip",
              onClick: () => openTwitchUrl(data.editUrl),
            }
          : undefined,
        description: "It may take a few seconds for the clip to be available.",
      }),
      error: (err) => err.message || "An unexpected error occurred while creating the clip",
    });

    try {
      return await clipPromise;
    } catch (error) {
      console.error("Error creating clip:", error);
      return {
        success: false as const,
        error: error instanceof Error ? error.message : "An unexpected error occurred while creating the clip",
      };
    } finally {
      set({ isSubmittingClip: false });
    }
  },

  createMarker: async (description?: string) => {
    const { video, fetchEvents } = get();
    if (!video) return;

    const markerPromise = (async () => {
      const result = await createStreamMarker(description);
      if (result.success && result.data) {
        // Refetch events so the new marker appears on the timeline
        fetchEvents(video.id);
        return result.data;
      } else {
        throw new Error(!result.success ? result.error : "Failed to create marker");
      }
    })();

    toast.promise(markerPromise, {
      loading: "Creating marker...",
      success: "Marker created successfully!",
      error: (err) => err.message || "An unexpected error occurred while creating the marker",
    });

    await markerPromise;
  },

  // Utility actions
  seekToClipStart: () => {
    const { clipStartTime } = get();
    get().seek(clipStartTime);
  },

  resetState: () => {
    set({
      ...initialState,
      // Keep playerKey to ensure fresh player on next open
      playerKey: get().playerKey,
    });
  },

  // Timeline actions
  setZoomLevel: (zoom) => set({ zoomLevel: zoom }),

  setIsSeekDisabled: (disabled) => set({ isSeekDisabled: disabled }),

  setViewOffset: (offset) => set({ viewOffset: offset }),

  zoomIn: (centerPoint) => {
    const { video, zoomLevel, clipStartTime, clipEndTime, currentTime } = get();
    if (!video) return;

    const totalSeconds = parseDuration(video.duration);
    const newZoom = Math.min(zoomLevel * 1.5, 20);
    const center = (centerPoint ?? (clipStartTime + clipEndTime) / 2) || currentTime;
    const newVisibleDuration = totalSeconds / newZoom;
    const newOffset = Math.max(0, center - newVisibleDuration / 2);

    set({
      zoomLevel: newZoom,
      viewOffset: Math.min(newOffset, totalSeconds - newVisibleDuration),
    });
  },

  zoomOut: (centerPoint) => {
    const { video, zoomLevel, clipStartTime, clipEndTime, currentTime } = get();
    if (!video) return;

    const totalSeconds = parseDuration(video.duration);
    const newZoom = Math.max(zoomLevel / 1.5, 1);
    const center = (centerPoint ?? (clipStartTime + clipEndTime) / 2) || currentTime;
    const newVisibleDuration = totalSeconds / newZoom;
    const newOffset = Math.max(0, center - newVisibleDuration / 2);

    set({
      zoomLevel: newZoom,
      viewOffset: newZoom === 1 ? 0 : Math.min(newOffset, totalSeconds - newVisibleDuration),
    });
  },

  setDragging: (handle) => set({ dragging: handle }),

  setDragStartInfo: (info) => set({ dragStartInfo: info }),

  initializeZoomForClip: () => {
    const { video, clipStartTime, clipEndTime } = get();
    if (!video) return;

    const totalSeconds = parseDuration(video.duration);
    const clipCenter = (clipStartTime + clipEndTime) / 2;
    const clipDuration = clipEndTime - clipStartTime;
    // Set zoom to show approximately 5x the clip duration
    const newZoom = Math.max(1, totalSeconds / (clipDuration * 5));
    const clampedZoom = Math.min(newZoom, 20);
    const newOffset = Math.max(0, clipCenter - totalSeconds / clampedZoom / 2);

    set({
      zoomLevel: clampedZoom,
      viewOffset: Math.min(newOffset, totalSeconds - totalSeconds / clampedZoom),
    });
  },

  resetZoom: () => {
    set({
      zoomLevel: 1,
      viewOffset: 0,
    });
  },
}));

// Selector hooks for commonly used derived state
export const useVideoPlayerVideo = () => useVideoPlayerStore((state) => state.video);
export const useVideoPlayerReady = () => useVideoPlayerStore((state) => state.isPlayerReady);
export const useVideoPlayerIsPlaying = () => useVideoPlayerStore((state) => state.isPlaying);
export const useVideoPlayerIsMuted = () => useVideoPlayerStore((state) => state.isMuted);
export const useVideoPlayerCurrentTime = () => useVideoPlayerStore((state) => state.currentTime);
export const useVideoPlayerEvents = () => useVideoPlayerStore((state) => state.events);
export const useVideoPlayerIsLoadingEvents = () => useVideoPlayerStore((state) => state.isLoadingEvents);
export const useVideoPlayerIsCreatingClip = () => useVideoPlayerStore((state) => state.isCreatingClip);
export const useVideoPlayerClipSelection = () =>
  useVideoPlayerStore((state) => ({
    startTime: state.clipStartTime,
    endTime: state.clipEndTime,
  }));
