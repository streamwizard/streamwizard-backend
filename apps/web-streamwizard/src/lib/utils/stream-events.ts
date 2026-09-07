import { LucideIcon, Tv, UserPlus, MessageSquare, Zap, Swords, Ban, Gift, Bell, Settings, Users, Megaphone, AlertCircle, CheckCircle2, HandMetal, Scissors, Flag, ArrowLeftRight } from "lucide-react";

export const SUB_EVENT_TYPES = [
  "channel.subscribe",
  "channel.subscription.message",
  "channel.subscription.gift",
] as const;
import { StreamEvent, StreamEventType } from "@/types/stream-events";

/**
 * Complete display data for rendering a stream event in the UI
 */
export interface StreamEventDisplayInfo {
  /** Display label for the event type */
  label: string;
  /** Background color class for the event badge */
  color: string;
  /** Icon component for the event */
  icon: LucideIcon;
  /** Context-specific subtitle (e.g., "500 bits", "Tier 1") */
  subtitle: string | null;
  /** User name associated with the event */
  userName?: string;
  /** Message content from the event */
  message?: string;
  /** Formatted amount (e.g., "500 bits", "3 gifts") */
  amount?: string;
}

/**
 * Event type display configuration
 */
const EVENT_TYPE_CONFIG: Record<StreamEventType, { label: string; color: string; icon: LucideIcon }> = {
  "channel.ad_break.begin": { label: "Ad Break", color: "bg-amber-500", icon: Tv },
  "channel.follow": { label: "Follow", color: "bg-blue-500", icon: UserPlus },
  "channel.subscription.message": { label: "Subscription", color: "bg-purple-500", icon: MessageSquare },
  "channel.subscription.gift": { label: "Gifted Sub", color: "bg-pink-500", icon: Gift },
  "channel.cheer": { label: "Cheer", color: "bg-emerald-500", icon: Zap },
  "channel.raid": { label: "Raid", color: "bg-indigo-500", icon: Swords },
  "channel.ban": { label: "Ban", color: "bg-red-600", icon: Ban },
  "channel.unban": { label: "Unban", color: "bg-green-600", icon: CheckCircle2 },
  "channel.chat.notification": { label: "Chat Notification", color: "bg-slate-500", icon: Bell },
  "channel.chat_settings.update": { label: "Chat Settings", color: "bg-slate-600", icon: Settings },
  "channel.moderator.add": { label: "Mod Added", color: "bg-orange-500", icon: Users },
  "channel.shoutout.create": { label: "Shoutout", color: "bg-fuchsia-500", icon: Megaphone },
  "channel.channel_points_custom_reward_redemption.add": { label: "Points Redemption", color: "bg-cyan-500", icon: HandMetal },
  "channel.update": { label: "Channel Update", color: "bg-slate-400", icon: Settings },
  "channel.chat.clear": { label: "Chat Cleared", color: "bg-slate-700", icon: Ban },
  "channel.chat.clear_user_messages": { label: "User Cleared", color: "bg-slate-700", icon: Ban },
  "channel.chat.message": { label: "Message", color: "bg-slate-400", icon: MessageSquare },
  "channel.chat.message_delete": { label: "Message Deleted", color: "bg-slate-700", icon: Ban },
  "channel.chat.user_message_hold": { label: "Message Held", color: "bg-slate-700", icon: AlertCircle },
  "channel.chat.user_message_update": { label: "Message Updated", color: "bg-slate-400", icon: MessageSquare },
  "channel.shared_chat.begin": { label: "Shared Chat", color: "bg-slate-500", icon: Users },
  "channel.shared_chat.update": { label: "Shared Chat Update", color: "bg-slate-500", icon: Users },
  "channel.shared_chat.end": { label: "Shared Chat End", color: "bg-slate-500", icon: Users },
  "channel.subscribe": { label: "Subscription", color: "bg-purple-500", icon: MessageSquare },
  "channel.subscription.end": { label: "Subscription End", color: "bg-slate-500", icon: MessageSquare },
  "channel.unban_request.create": { label: "Unban Request", color: "bg-orange-400", icon: AlertCircle },
  "channel.unban_request.resolve": { label: "Unban Resolved", color: "bg-green-500", icon: CheckCircle2 },
  "channel.moderate": { label: "Interaction", color: "bg-slate-500", icon: Settings },
  "channel.moderator.remove": { label: "Mod Removed", color: "bg-slate-500", icon: Users },
  "channel.channel_points_automatic_reward_redemption.add": { label: "Points Redemption", color: "bg-cyan-500", icon: HandMetal },
  "channel.channel_points_custom_reward.add": { label: "Reward Added", color: "bg-cyan-600", icon: HandMetal },
  "channel.channel_points_custom_reward.update": { label: "Reward Updated", color: "bg-cyan-600", icon: HandMetal },
  "channel.channel_points_custom_reward.remove": { label: "Reward Removed", color: "bg-cyan-600", icon: HandMetal },
  "channel.channel_points_custom_reward_redemption.update": { label: "Redemption Updated", color: "bg-cyan-600", icon: HandMetal },
  "channel.shoutout.receive": { label: "Shoutout Received", color: "bg-fuchsia-600", icon: Megaphone },
  "obs.scene_switch": { label: "Scene Switch", color: "bg-sky-500", icon: ArrowLeftRight },
  clip: { label: "Clip", color: "bg-teal-500", icon: Scissors },
  marker: { label: "Marker", color: "bg-yellow-500", icon: Flag },
};

/**
 * Get all display information needed to render a stream event.
 * Combines type info, subtitle, and display data into a single call.
 */
export function getStreamEventDisplayInfo(event: StreamEvent): StreamEventDisplayInfo {
  const eventType = event.event_type as StreamEventType;
  const typeConfig = EVENT_TYPE_CONFIG[eventType] || { label: eventType, color: "bg-gray-500", icon: AlertCircle };
  const data = event.event_data as Record<string, unknown> | null;

  const result: StreamEventDisplayInfo = {
    ...typeConfig,
    subtitle: null,
  };

  if (!data) return result;

  // Extract user name from common fields
  const userName = (data.user_name as string) || (data.from_broadcaster_user_name as string) || (data.to_broadcaster_user_name as string) || (data.chatter_user_name as string);
  if (userName) result.userName = userName;

  // Extract message from common fields.
  // Twitch EventSub returns message as {text, emotes} for subscription events — extract .text.
  const rawMessage = data.message;
  const messageText =
    typeof rawMessage === "string"
      ? rawMessage
      : typeof rawMessage === "object" && rawMessage !== null && typeof (rawMessage as Record<string, unknown>).text === "string"
      ? ((rawMessage as Record<string, unknown>).text as string)
      : null;
  const message = messageText || (data.user_input as string) || (data.reason as string);
  if (message) result.message = message;

  // Extract subtitle and amount based on event type
  switch (eventType) {
    case "channel.channel_points_custom_reward_redemption.add":
    case "channel.channel_points_custom_reward_redemption.update":
    case "channel.channel_points_automatic_reward_redemption.add": {
      const reward = data.reward as { title?: string; cost?: number } | undefined;
      if (reward?.title) {
        result.subtitle = `${reward.title}${reward.cost ? ` (${reward.cost} pts)` : ""}`;
      } else {
        const userInput = data.user_input as string | undefined;
        if (userInput) result.subtitle = userInput;
      }
      if (reward?.cost) result.amount = `${reward.cost} points`;
      break;
    }

    case "channel.cheer": {
      const bits = data.bits as number | undefined;
      if (bits) {
        result.subtitle = `${bits} bits`;
        result.amount = `${bits} bits`;
      }
      break;
    }

    case "channel.raid": {
      const viewers = data.viewers as number | undefined;
      const fromName = data.from_broadcaster_user_name as string | undefined;
      if (viewers && fromName) result.subtitle = `${fromName} with ${viewers} viewers`;
      else if (viewers) result.subtitle = `${viewers} viewers`;
      if (viewers) result.amount = `${viewers} viewers`;
      break;
    }

    case "channel.subscribe":
    case "channel.subscription.message": {
      const tier = data.tier as string | undefined;
      const tierLabel = tier === "1000" ? "Tier 1" : tier === "2000" ? "Tier 2" : tier === "3000" ? "Tier 3" : tier;
      result.subtitle = tierLabel || null;
      break;
    }

    case "channel.subscription.gift": {
      const total = data.total as number | undefined;
      const tier = data.tier as string | undefined;
      const tierLabel = tier === "1000" ? "Tier 1" : tier === "2000" ? "Tier 2" : tier === "3000" ? "Tier 3" : "";
      if (total) {
        result.subtitle = `${total} gift${total > 1 ? "s" : ""}${tierLabel ? ` (${tierLabel})` : ""}`;
        result.amount = `${total} gift${total > 1 ? "s" : ""}`;
      }
      break;
    }

    case "channel.ban": {
      const reason = data.reason as string | undefined;
      const isPermanent = data.is_permanent as boolean | undefined;
      if (isPermanent === false) {
        const ends = data.ends_at as string | undefined;
        if (ends) result.subtitle = `Timeout until ${new Date(ends).toLocaleTimeString()}`;
      }
      if (!result.subtitle) result.subtitle = reason || (isPermanent ? "Permanent" : null);
      break;
    }

    case "channel.shoutout.create":
    case "channel.shoutout.receive": {
      const targetName = data.to_broadcaster_user_name as string | undefined;
      const fromName = data.from_broadcaster_user_name as string | undefined;
      result.subtitle = targetName || fromName || null;
      break;
    }

    case "channel.moderator.add":
    case "channel.moderator.remove": {
      const modName = data.user_name as string | undefined;
      result.subtitle = modName || null;
      break;
    }

    case "clip": {
      const title = data.title as string | undefined;
      const creatorName = data.creator_name as string | undefined;
      const viewCount = data.view_count as number | undefined;
      result.subtitle = title || null;
      if (creatorName) result.userName = creatorName;
      if (viewCount !== undefined) result.amount = `${viewCount} views`;
      break;
    }

    case "marker": {
      const description = data.description as string | undefined;
      result.subtitle = description || null;
      break;
    }

    case "obs.scene_switch": {
      const fromScene = data.from_scene as string | undefined;
      const toScene = data.to_scene as string | undefined;
      if (fromScene && toScene) result.subtitle = `${fromScene} → ${toScene}`;
      else if (toScene) result.subtitle = toScene;
      break;
    }
  }

  return result;
}

/**
 * Get just the type info for an event type (for use in legends/filters where we don't have a full event)
 */
export function getEventTypeInfo(type: StreamEventType): { label: string; color: string; icon: LucideIcon } {
  return EVENT_TYPE_CONFIG[type] || { label: type, color: "bg-gray-500", icon: AlertCircle };
}
