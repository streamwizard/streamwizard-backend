import type { TwitchPlayer } from "@/components/vods/twitch-player";
import type { TimelineEvent, TimelineSegment, TimelineSegmentType } from "@/components/vods/timeline/types";
import type { Clip } from "@/types/stream-events";
import type { TwitchVideo } from "@/types/twitch-video";
import type { StreamEvent } from "./event-mappers";

/** State and action surface of the VOD dialog store. */

export type DragHandle = "start" | "end" | "middle" | null;

/** Drag start info for middle handle dragging */
export interface DragStartInfo {
  clientX: number;
  startTime: number;
  endTime: number;
}

export interface VideoPlayerState {
  // Dialog state
  video: TwitchVideo | null;

  // Player state
  player: TwitchPlayer | null;
  isPlaying: boolean;
  isMuted: boolean;
  currentTime: number;
  isPlayerReady: boolean;
  playerKey: number;

  // Stream events & clips state
  events: StreamEvent[];
  clips: Clip[];
  filteredEvents: StreamEvent[];
  timelineEvents: TimelineEvent[];
  selectedEventTypes: Set<string>;
  isLoadingEvents: boolean;

  // Timeline segments (muted, ad breaks, etc.)
  segments: Map<TimelineSegmentType, TimelineSegment[]>;

  // Clip creation state
  isCreatingClip: boolean;
  clipTitle: string;
  clipStartTime: number;
  clipEndTime: number;
  isSubmittingClip: boolean;

  // Timeline state
  zoomLevel: number;
  viewOffset: number;
  dragging: DragHandle;
  dragStartInfo: DragStartInfo | null;
  isSeekDisabled: boolean;
}

export interface VideoPlayerActions {
  // Dialog actions
  setVideo: (video: TwitchVideo | null) => void;

  // Player actions
  setPlayer: (player: TwitchPlayer | null) => void;
  setPlayerReady: (ready: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsMuted: (muted: boolean) => void;
  setCurrentTime: (time: number) => void;
  incrementPlayerKey: () => void;

  // Playback controls
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  toggleMute: () => void;
  seek: (seconds: number) => void;

  // Event actions
  setEvents: (events: StreamEvent[]) => void;
  setFilteredEvents: (events: StreamEvent[]) => void;
  setIsLoadingEvents: (loading: boolean) => void;
  fetchEvents: (videoId: string) => Promise<void>;
  seekToEvent: (eventId: string) => void;
  toggleEventType: (type: string) => void;
  selectAllEventTypes: () => void;
  deselectAllEventTypes: () => void;

  // Segment actions
  setMutedSegments: (segments: { duration: number; offset: number }[] | null) => void;

  // Clip creation actions
  startClipCreation: (atOffset?: number) => void;
  cancelClipCreation: () => void;
  setClipTitle: (title: string) => void;
  setClipStartTime: (time: number) => void;
  setClipEndTime: (time: number) => void;
  setClipSelection: (start: number, end: number) => void;
  saveClip: () => Promise<{ success: boolean; error?: string; editUrl?: string; clipId?: string }>;

  // Marker actions
  createMarker: (description?: string) => Promise<void>;

  // Utility actions
  seekToClipStart: () => void;
  resetState: () => void;

  // Timeline actions
  setZoomLevel: (zoom: number) => void;
  setViewOffset: (offset: number) => void;
  zoomIn: (centerPoint?: number) => void;
  zoomOut: (centerPoint?: number) => void;
  setDragging: (handle: DragHandle) => void;
  setDragStartInfo: (info: DragStartInfo | null) => void;
  initializeZoomForClip: () => void;
  resetZoom: () => void;
  setIsSeekDisabled: (disabled: boolean) => void;
}

export type VideoPlayerStore = VideoPlayerState & VideoPlayerActions;
