import type { EventSubNotificationPayload, EventSubSubscriptionType, WebSocketNotificationMessage } from "@repo/types";
import { z } from "zod";
import { TwitchApi } from "@repo/twitch-api";
import { registerTwitchHandlers } from "./twitch";
import { registerMinecraftHandlers } from "./minecraft";
import { MinecraftMessageType } from "@/types/minecraft-incomming-websocket-messages";
import { MinecraftActions } from "@/classes/minecraft/handle-minecraft-actions";
import { streamEventsLogger } from "@repo/logger";

/**
 * Context passed to all event handlers in smp-bridge
 */
export interface SmpBridgeHandlerContext {
  twitchApi: TwitchApi;
  minecraftActions: MinecraftActions;
}

/**
 * Handler function signatures
 */
type TwitchHandler<TData = unknown> = (
  data: TData,
  context: SmpBridgeHandlerContext
) => Promise<void>;

type MinecraftHandler<TData = unknown> = (
  data: TData,
  context: SmpBridgeHandlerContext
) => Promise<void>;

/**
 * Internal handler wrapper
 */
type InternalHandler = (
  data: unknown,
  context: SmpBridgeHandlerContext
) => Promise<void>;

/**
 * Handler Registry for smp-bridge supporting both Twitch and Minecraft events
 */
export class HandlerRegistry {
  private twitchHandlers = new Map<string, InternalHandler>();
  private minecraftHandlers = new Map<string, InternalHandler>();

  constructor() {
    registerTwitchHandlers(this);
    registerMinecraftHandlers(this);
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
    schema?: z.ZodType<TData>
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
    if (!handler) {
      console.log("No Twitch handler found for event type:", eventType);
      return;
    }

    const broadcasterId = extractReceivingBroadcasterId(data.payload.event);

    if (!broadcasterId) {
      console.log("No broadcaster ID found in event:", data.payload.event);
      return;
    }



    const twitchApi = new TwitchApi(broadcasterId);
    const minecraftActions = new MinecraftActions(broadcasterId, twitchApi);

    const context: SmpBridgeHandlerContext = {
      twitchApi,
      minecraftActions,
    };

    await handler(data.payload.event ?? data.payload, context);
  }

  // ============================================================================
  // Minecraft Handlers
  // ============================================================================

  /**
   * Register a handler for a Minecraft event type
   */
  registerMinecraftHandler<TData = unknown>(
    eventType: MinecraftMessageType,
    handler: MinecraftHandler<TData>,
    schema?: z.ZodType<TData>
  ): void {
    this.minecraftHandlers.set(eventType, async (data, context) => {
      try {
        const parsedData = schema ? schema.parse(data) : (data as TData);
        await handler(parsedData, context);
      } catch (error) {
        console.log(`Error in Minecraft handler for ${eventType}:`, error);
      }
    });
  }

  /**
   * Process Minecraft events
   */
  async processMinecraftEvent(
    eventType: string,
    data: unknown,
    context: SmpBridgeHandlerContext
  ): Promise<void> {

    console.log("Processing Minecraft event:", eventType);


    const handler = this.minecraftHandlers.get(eventType);
    if (!handler) {
      console.log("No Minecraft handler found for event type:", eventType);
      return;
    }

    await handler(data, context);
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
