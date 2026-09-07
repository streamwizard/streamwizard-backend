import type { TimelineSegment, TimelineSegmentType } from "@/components/vods/timeline/types";
import type { VideoPlayerState } from "./types";

/** Every field the store resets to — also what `resetState()` restores. */

export const initialState: VideoPlayerState = {
  // Dialog state
  video: null,

  // Player state
  player: null,
  isPlaying: false,
  isMuted: true,
  currentTime: 0,
  isPlayerReady: false,
  playerKey: 0,

  // Stream events & clips state
  events: [],
  clips: [],
  filteredEvents: [],
  timelineEvents: [],
  selectedEventTypes: new Set<string>([
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
  ]),
  isLoadingEvents: false,

  // Timeline segments
  segments: new Map(),

  // Clip creation state
  isCreatingClip: false,
  clipTitle: "",
  clipStartTime: 0,
  clipEndTime: 30,
  isSubmittingClip: false,

  // Timeline state
  zoomLevel: 1,
  viewOffset: 0,
  dragging: null,
  dragStartInfo: null,
  isSeekDisabled: false,
};
