import type { Database } from "@repo/supabase";

/**
 * Stream Event Types from Supabase
 */

/**
 * Event types that can occur during a stream
 */
export type StreamEventType =
  // Channel Topics
  | "channel.update"
  | "channel.follow"
  | "channel.ad_break.begin"
  | "channel.chat.clear"
  | "channel.chat.clear_user_messages"
  | "channel.chat.message"
  | "channel.chat.message_delete"
  | "channel.chat.notification"
  | "channel.chat_settings.update"
  | "channel.chat.user_message_hold"
  | "channel.chat.user_message_update"
  | "channel.shared_chat.begin"
  | "channel.shared_chat.update"
  | "channel.shared_chat.end"
  | "channel.subscribe"
  | "channel.subscription.end"
  | "channel.subscription.gift"
  | "channel.subscription.message"
  | "channel.cheer"
  | "channel.raid"
  | "channel.ban"
  | "channel.unban"
  | "channel.unban_request.create"
  | "channel.unban_request.resolve"
  | "channel.moderate"
  | "channel.moderator.add"
  | "channel.moderator.remove"

  // Channel Points Topics
  | "channel.channel_points_automatic_reward_redemption.add"
  | "channel.channel_points_custom_reward.add"
  | "channel.channel_points_custom_reward.update"
  | "channel.channel_points_custom_reward.remove"
  | "channel.channel_points_custom_reward_redemption.add"
  | "channel.channel_points_custom_reward_redemption.update"

  // Shoutout Topics
  | "channel.shoutout.create"
  | "channel.shoutout.receive"

  // Cloud OBS (logged by the auto switcher, reason "manual" covers deck switches)
  | "obs.scene_switch"

  // Clips
  | "clip"

  // Stream Markers
  | "marker";

/**
 * A stream event stored in Supabase (matches stream_events table schema)
 */
export type StreamEvent = Database["public"]["Tables"]["stream_events"]["Row"];

/**
 * A clip stored in Supabase (matches clips table schema)
 */
export type Clip = Database["public"]["Tables"]["clips"]["Row"] & {
  folder_ids: string[];
};

/**
 * Result of fetching stream data (events + clips) via get_stream_data RPC
 */
export interface GetStreamDataResult {
  success: boolean;
  events?: StreamEvent[];
  clips?: Clip[];
  error?: string;
}
