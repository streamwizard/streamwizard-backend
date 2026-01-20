import { TwitchApi } from "@repo/twitch-api";
import type { EventSubSubscriptionType, WebSocketNotificationMessage } from "@repo/types";
import { z } from "zod";
import { registerTwitchHandlers } from "./twitch";
import { streamEventsLogger } from "@repo/logger";

/**
 * Context passed to all event handlers in smp-bridge
 */
export interface HandlerContext {
  twitchApi: TwitchApi;
}

/**
 * Handler function signatures
 */
type TwitchHandler<TData = unknown> = (data: TData, context: HandlerContext) => Promise<void>;

/**
 * Internal handler wrapper
 */
type InternalHandler = (data: unknown, context: HandlerContext) => Promise<void>;

/**
 * Handler Registry for smp-bridge supporting both Twitch and Minecraft events
 */
export class HandlerRegistry {
  private twitchHandlers = new Map<string, InternalHandler>();

  constructor() {
    registerTwitchHandlers(this);
  }

  // ============================================================================
  // Twitch Handlers
  // ============================================================================

  /**
   * Register a handler for a Twitch EventSub event type
   */
  registerTwitchHandler<TData = unknown>(
    eventType: EventSubSubscriptionType,
    handler: TwitchHandler<TData>,
    schema?: z.ZodType<TData>,
  ): void {
    this.twitchHandlers.set(eventType, async (data, context) => {
      try {
        const parsedData = schema ? schema.parse(data) : (data as TData);
        await handler(parsedData, context);
      } catch (error) {
        console.log(`Error in Twitch handler for ${eventType}:`, error);
      }
    });
  }

  /**
   * Process Twitch EventSub events
   */
  async processTwitchEvent(
    eventType: EventSubSubscriptionType,
    data: WebSocketNotificationMessage,
  ): Promise<void> {
    const handler = this.twitchHandlers.get(eventType);

    const broadcasterId = extractReceivingBroadcasterId(data.payload.event);

    if (!broadcasterId) {
      console.log("No broadcaster ID found in event:", data.payload.event);
      return;
    }

    if (eventType !== "channel.chat.message") {
      streamEventsLogger.logTwitchEvent({
        broadcaster_id: broadcasterId,
        event_type: eventType,
        event_data: data.payload.event,
        metadata: data.metadata,
      });
    }

    const twitchApi = new TwitchApi(broadcasterId);

    const context: HandlerContext = {
      twitchApi,
    };

    if (!handler) {
      console.log("No Twitch handler found for event type:", eventType);
      return;
    }

    await handler(data.payload.event, context);
  }
}

export const handlers = new HandlerRegistry();

/**
 * Extract the broadcaster ID from an EventSub event payload
 */
export function extractReceivingBroadcasterId(event: Record<string, unknown>): string | null {
  if (!event) return null;

  // Direct to_broadcaster_user_id (raid events)
  if (typeof event.to_broadcaster_user_id === "string" && event.to_broadcaster_user_id) {
    return event.to_broadcaster_user_id;
  }

  // Standard broadcaster_user_id
  if (typeof event.broadcaster_user_id === "string" && event.broadcaster_user_id) {
    return event.broadcaster_user_id;
  }

  // Check nested data array
  if (Array.isArray(event.data) && event.data.length > 0) {
    const d0 = event.data[0] as Record<string, unknown>;
    if (d0?.to_broadcaster_user_id) return d0.to_broadcaster_user_id as string;
    if (d0?.broadcaster_user_id) return d0.broadcaster_user_id as string;
  }

  return null;
}
