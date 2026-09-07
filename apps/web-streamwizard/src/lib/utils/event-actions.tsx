"use client";

import TwitchClipModal from "@/components/modals/twitch-clip-modal";
import { openTwitchUrl } from "@/lib/utils/open-twitch-url";
import { StreamEvent, StreamEventType } from "@/types/stream-events";
import { LucideIcon, Scissors, ExternalLink, Copy, Flag, Crosshair, Play } from "lucide-react";
import { toast } from "sonner";

/**
 * A single context menu action for an event
 */
export interface EventAction {
  label: string;
  icon: LucideIcon;
  handler: (event: StreamEvent, helpers: EventActionHelpers) => void;
}

/**
 * Helper functions passed to action handlers for interacting with the app
 */
export interface EventActionHelpers {
  /** Seek the player to a specific time in seconds */
  seek: (seconds: number) => void;
  /** Start clip creation centered on a specific offset */
  startClipCreation: (atOffset?: number) => void;
  /** Open a modal with the given React content */
  openModal: (content: React.ReactNode) => void;
}

// =============================================================================
// Per-type action definitions
// =============================================================================

const clipActions: EventAction[] = [
  {
    label: "View Clip",
    icon: Play,
    handler: (event, { openModal }) => {
      const data = event.event_data as Record<string, unknown> | null;
      const embedUrl = data?.embed_url as string | undefined;

      console.log(event.event_data);
      if (embedUrl) {
        openModal(<TwitchClipModal url={embedUrl} />);
      }
    },
  },
  {
    label: "View on Twitch",
    icon: ExternalLink,
    handler: (event) => {
      const data = event.event_data as Record<string, unknown> | null;
      const url = data?.url as string | undefined;
      openTwitchUrl(url);
    },
  },

  {
    label: "Copy URL",
    icon: Copy,
    handler: (event) => {
      const data = event.event_data as Record<string, unknown> | null;
      const url = data?.url as string | undefined;
      if (url) {
        navigator.clipboard.writeText(url);
        toast.success("Clip URL copied to clipboard");
      }
    },
  },
];

const markerActions: EventAction[] = [
  {
    label: "Create Clip Here",
    icon: Scissors,
    handler: (event, { startClipCreation }) => {
      startClipCreation(event.offset_seconds ?? 0);
    },
  },
];

// =============================================================================
// Default action (available for all event types)
// =============================================================================

const defaultActions: EventAction[] = [
  {
    label: "Seek Here",
    icon: Crosshair,
    handler: (event, { seek }) => {
      seek(event.offset_seconds ?? 0);
    },
  },
];

// =============================================================================
// Registry
// =============================================================================

const eventActionRegistry: Partial<Record<StreamEventType, EventAction[]>> = {
  clip: clipActions,
  marker: markerActions,
};

/**
 * Get all context menu actions for a given event.
 * Returns type-specific actions first, then default actions.
 */
export function getEventActions(event: StreamEvent): EventAction[] {
  const eventType = event.event_type as StreamEventType;
  const typeActions = eventActionRegistry[eventType] ?? [];
  return [...typeActions, ...defaultActions];
}
