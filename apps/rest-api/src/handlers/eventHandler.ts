import type { EventSubNotificationPayload, EventSubSubscriptionType } from "@repo/types";
import { z } from "zod";
import { TwitchApi } from "@repo/twitch-api";
import { supabase } from "@repo/supabase";
import { registerTwitchHandlers } from "./twitch";

/**
 * Context passed to all Twitch event handlers in rest-api
 */
export interface RestApiHandlerContext {
  twitchApi: TwitchApi;
}

/**
 * Handler function signature
 */
type EventHandler<TData = unknown> = (
  data: TData,
  context: RestApiHandlerContext
) => Promise<void>;

/**
 * Internal handler wrapper
 */
type InternalHandler = (
  data: unknown,
  context: RestApiHandlerContext
) => Promise<void>;

/**
 * Handler Registry for rest-api Twitch EventSub events
 */
export class HandlerRegistry {
  private twitchHandlers = new Map<string, InternalHandler>();

  constructor() {
    registerTwitchHandlers(this);
  }

  /**
   * Register a handler for a Twitch EventSub event type
   */
  registerTwitchHandler<TData = unknown>(
    eventType: EventSubSubscriptionType,
    handler: EventHandler<TData>,
    schema?: z.ZodType<TData>
  ): void {
    this.twitchHandlers.set(eventType, async (data, context) => {
      try {
        const parsedData = schema ? schema.parse(data) : (data as TData);
        await handler(parsedData, context);
      } catch (error) {
        console.log(`Error in handler for ${eventType}:`, error);
      }
    });
  }

  /**
   * Process Twitch EventSub events with broadcaster validation
   */
  async processTwitchEvent(
    eventType: EventSubSubscriptionType,
    data: EventSubNotificationPayload
  ): Promise<void> {
    const broadcasterId = extractReceivingBroadcasterId(data as unknown as Record<string, unknown>);

    if (!broadcasterId) {
      console.log("No broadcaster id found in event");
      throw new Error("No broadcaster id found in event");
    }

    // Check if the broadcaster is known to the database
    const { data: broadcaster, error: broadcasterError } = await supabase
      .from("integrations_twitch")
      .select("user_id")
      .eq("twitch_user_id", broadcasterId)
      .single();

    if (broadcasterError || !broadcaster) {
      console.log("Broadcaster not found in database");
      return;
    }

    const handler = this.twitchHandlers.get(eventType);
    if (!handler) {
      console.log("No handler found for event type:", eventType);
      return;
    }

    const twitchApi = new TwitchApi(broadcasterId);
    const context: RestApiHandlerContext = { twitchApi };

    await handler(data, context);
  }
}

export const handlers = new HandlerRegistry();

/**
 * Extract the broadcaster ID from an EventSub event payload
 */
function extractReceivingBroadcasterId(event: Record<string, unknown>): string | null {
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
