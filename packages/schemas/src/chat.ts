import { z } from "zod";
import { BadgeSchema, EnrichedUserProfileSchema } from "./shared";

// ─── Shared chat fragment (richer than automod) ──────────────────────────────

const ChatFragmentSchema = z.object({
  type: z.enum(["text", "cheermote", "emote", "mention"]),
  text: z.string(),
  cheermote: z
    .object({
      prefix: z.string(),
      bits: z.number().int(),
      tier: z.number().int(),
    })
    .nullable()
    .optional(),
  emote: z
    .object({
      id: z.string(),
      emote_set_id: z.string(),
      owner_id: z.string().optional(),
      /** "static" and/or "animated" — which image formats Twitch has for it. */
      format: z.array(z.string()).optional(),
    })
    .nullable()
    .optional(),
  mention: z
    .object({
      user_id: z.string(),
      user_name: z.string(),
      user_login: z.string(),
    })
    .nullable()
    .optional(),
});

// ─── channel.chat.clear ─────────────────────────────────────────────────────

export const ChannelChatClearEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
});

export type ChannelChatClearEvent = z.infer<typeof ChannelChatClearEventSchema>;

// ─── channel.chat.clear_user_messages ───────────────────────────────────────

export const ChannelChatClearUserMessagesEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
  target_user_id: z.string(),
  target_user_name: z.string(),
  target_user_login: z.string(),
});

export type ChannelChatClearUserMessagesEvent = z.infer<
  typeof ChannelChatClearUserMessagesEventSchema
>;

// ─── channel.chat.message ───────────────────────────────────────────────────

export const ChannelChatMessageEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  chatter_user_id: z.string(),
  chatter_user_login: z.string(),
  chatter_user_name: z.string(),
  message_id: z.string(),
  message: z.object({
    text: z.string(),
    fragments: z.array(ChatFragmentSchema),
  }),
  color: z.string(),
  badges: z.array(BadgeSchema),
  ...EnrichedUserProfileSchema.shape,
  message_type: z.enum([
    "text",
    "channel_points_highlighted",
    "channel_points_sub_only",
    "user_intro",
    "power_ups_message_effect",
    "power_ups_gigantified_emote",
  ]),
  cheer: z.object({ bits: z.number().int() }).nullable().optional(),
  reply: z
    .object({
      parent_message_id: z.string(),
      parent_message_body: z.string(),
      parent_user_id: z.string(),
      parent_user_name: z.string(),
      parent_user_login: z.string(),
      thread_message_id: z.string(),
      thread_user_id: z.string(),
      thread_user_name: z.string(),
      thread_user_login: z.string(),
    })
    .nullable()
    .optional(),
  channel_points_custom_reward_id: z.string().nullable().optional(),
  source_broadcaster_user_id: z.string().nullable().optional(),
  source_broadcaster_user_login: z.string().nullable().optional(),
  source_broadcaster_user_name: z.string().nullable().optional(),
  source_message_id: z.string().nullable().optional(),
  source_badges: z.array(BadgeSchema).nullable().optional(),
  is_source_only: z.boolean().nullable().optional(),
});

export type ChannelChatMessageEvent = z.infer<typeof ChannelChatMessageEventSchema>;

// ─── channel.chat.message_delete ────────────────────────────────────────────

export const ChannelChatMessageDeleteEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_name: z.string(),
  broadcaster_user_login: z.string(),
  target_user_id: z.string(),
  target_user_name: z.string(),
  target_user_login: z.string(),
  message_id: z.string(),
});

export type ChannelChatMessageDeleteEvent = z.infer<typeof ChannelChatMessageDeleteEventSchema>;

// ─── channel.chat.notification ──────────────────────────────────────────────

/**
 * The notice types Twitch documents today. Not exhaustive by contract — the
 * list is explicitly subject to change and an `unknown` value exists — so treat
 * this as "the ones worth branching on", never as a closed set.
 *
 * The `shared_chat_*` variants are the same notices relayed from another
 * channel during a shared chat session, not events on this channel.
 */
export const CHAT_NOTICE_TYPES = [
  "sub",
  "resub",
  "sub_gift",
  "community_sub_gift",
  "gift_paid_upgrade",
  "prime_paid_upgrade",
  "pay_it_forward",
  "raid",
  "unraid",
  "announcement",
  "bits_badge_tier",
  "charity_donation",
  "watch_streak",
  "modiversary",
  "unknown",
  "shared_chat_sub",
  "shared_chat_resub",
  "shared_chat_sub_gift",
  "shared_chat_community_sub_gift",
  "shared_chat_gift_paid_upgrade",
  "shared_chat_prime_paid_upgrade",
  "shared_chat_pay_it_forward",
  "shared_chat_raid",
  "shared_chat_announcement",
  "shared_chat_modiversary",
] as const;

export type ChatNoticeType = (typeof CHAT_NOTICE_TYPES)[number];

/** True for a notice relayed from another channel during shared chat. */
export function isSharedChatNotice(noticeType: string): boolean {
  return noticeType.startsWith("shared_chat_");
}

const SubSchema = z.object({
  sub_plan: z.string(),
  is_gift: z.boolean(),
});

const ResubSchema = z.object({
  cumulative_months: z.number().int(),
  duration_months: z.number().int(),
  streak_months: z.number().int().nullable(),
  sub_plan: z.string(),
  is_gift: z.boolean(),
  gifter_is_anonymous: z.boolean().nullable(),
  gifter_user_id: z.string().nullable(),
  gifter_user_name: z.string().nullable(),
  gifter_user_login: z.string().nullable(),
});

const SubGiftSchema = z.object({
  duration_months: z.number().int(),
  cumulative_total: z.number().int().nullable(),
  recipient_user_id: z.string(),
  recipient_user_name: z.string(),
  recipient_user_login: z.string(),
  sub_plan: z.string(),
  community_gift_id: z.string().nullable(),
});

const CommunitySubGiftSchema = z.object({
  id: z.string(),
  total: z.number().int(),
  sub_plan: z.string(),
  cumulative_total: z.number().int().nullable(),
});

const GiftPaidUpgradeSchema = z.object({
  gifter_is_anonymous: z.boolean(),
  gifter_user_id: z.string().nullable(),
  gifter_user_name: z.string().nullable(),
  gifter_user_login: z.string().nullable(),
});

const RaidNoticeSchema = z.object({
  user_id: z.string(),
  user_name: z.string(),
  user_login: z.string(),
  viewer_count: z.number().int(),
  profile_image_url: z.string(),
});

const AnnouncementSchema = z.object({
  color: z.string(),
});

const BitsBadgeTierSchema = z.object({
  tier: z.number().int(),
});

const CharityDonationSchema = z.object({
  charity_name: z.string(),
  amount: z.object({
    value: z.number().int(),
    decimal_places: z.number().int(),
    currency: z.string(),
  }),
});

const WatchStreakSchema = z.object({
  consecutive_months: z.number().int(),
});

export const ChannelChatNotificationEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  chatter_user_id: z.string(),
  chatter_user_login: z.string(),
  chatter_user_name: z.string(),
  chatter_is_anonymous: z.boolean(),
  color: z.string(),
  badges: z.array(BadgeSchema),
  ...EnrichedUserProfileSchema.shape,
  system_message: z.string(),
  message_id: z.string(),
  message: z.object({
    text: z.string(),
    fragments: z.array(ChatFragmentSchema),
  }),
  /**
   * Deliberately a plain string rather than an enum. Twitch documents this
   * list as "subject to change" and already ships an `unknown` member, so a
   * closed enum turns every new notice type Twitch invents into a validation
   * failure. The known values are exported as CHAT_NOTICE_TYPES for the code
   * that wants to branch on them.
   */
  notice_type: z.string(),
  sub: SubSchema.nullable(),
  resub: ResubSchema.nullable(),
  sub_gift: SubGiftSchema.nullable(),
  community_sub_gift: CommunitySubGiftSchema.nullable(),
  gift_paid_upgrade: GiftPaidUpgradeSchema.nullable(),
  prime_paid_upgrade: z.object({ sub_plan: z.string() }).nullable(),
  pay_it_forward: GiftPaidUpgradeSchema.nullable(),
  raid: RaidNoticeSchema.nullable(),
  unraid: z.null(),
  announcement: AnnouncementSchema.nullable(),
  bits_badge_tier: BitsBadgeTierSchema.nullable(),
  charity_donation: CharityDonationSchema.nullable(),
  watch_streak: WatchStreakSchema.nullable(),
  // Twitch documents the notice type but not a payload object for it; kept
  // permissive so a shape appearing later doesn't fail validation.
  modiversary: z.unknown().nullable().optional(),
  shared_chat_modiversary: z.unknown().nullable().optional(),
  shared_chat_sub: SubSchema.nullable().optional(),
  shared_chat_resub: ResubSchema.nullable().optional(),
  shared_chat_sub_gift: SubGiftSchema.nullable().optional(),
  shared_chat_community_sub_gift: CommunitySubGiftSchema.nullable().optional(),
  shared_chat_gift_paid_upgrade: GiftPaidUpgradeSchema.nullable().optional(),
  shared_chat_prime_paid_upgrade: z.object({ sub_plan: z.string() }).nullable().optional(),
  shared_chat_pay_it_forward: GiftPaidUpgradeSchema.nullable().optional(),
  shared_chat_raid: RaidNoticeSchema.nullable().optional(),
  shared_chat_unraid: z.null().optional(),
  shared_chat_announcement: AnnouncementSchema.nullable().optional(),
  shared_chat_bits_badge_tier: BitsBadgeTierSchema.nullable().optional(),
  shared_chat_charity_donation: CharityDonationSchema.nullable().optional(),
  source_broadcaster_user_id: z.string().nullable().optional(),
  source_broadcaster_user_login: z.string().nullable().optional(),
  source_broadcaster_user_name: z.string().nullable().optional(),
  source_message_id: z.string().nullable().optional(),
  source_badges: z.array(BadgeSchema).nullable().optional(),
  is_source_only: z.boolean().nullable().optional(),
});

export type ChannelChatNotificationEvent = z.infer<typeof ChannelChatNotificationEventSchema>;

// ─── channel.chat_settings.update ───────────────────────────────────────────

export const ChannelChatSettingsUpdateEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  emote_mode: z.boolean(),
  follower_mode: z.boolean(),
  follower_mode_duration_minutes: z.number().int().nullable(),
  slow_mode: z.boolean(),
  slow_mode_wait_time_seconds: z.number().int().nullable(),
  subscriber_mode: z.boolean(),
  unique_chat_mode: z.boolean(),
});

export type ChannelChatSettingsUpdateEvent = z.infer<typeof ChannelChatSettingsUpdateEventSchema>;

// ─── channel.chat.user_message_hold ─────────────────────────────────────────

export const ChannelChatUserMessageHoldEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  message_id: z.string(),
  message: z.object({
    text: z.string(),
    fragments: z.array(ChatFragmentSchema),
  }),
});

export type ChannelChatUserMessageHoldEvent = z.infer<typeof ChannelChatUserMessageHoldEventSchema>;

// ─── channel.chat.user_message_update ───────────────────────────────────────

export const ChannelChatUserMessageUpdateEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  status: z.enum(["approved", "denied", "invalid"]),
  message_id: z.string(),
  message: z.object({
    text: z.string(),
    fragments: z.array(ChatFragmentSchema),
  }),
});

export type ChannelChatUserMessageUpdateEvent = z.infer<
  typeof ChannelChatUserMessageUpdateEventSchema
>;