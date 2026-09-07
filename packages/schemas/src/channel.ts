import { z } from "zod";
import { EnrichedUserProfileSchema } from "./shared";

// ─── channel.bits.use ───────────────────────────────────────────────────────

const BitsFragmentSchema = z.object({
  type: z.enum(["text", "cheermote", "emote"]),
  text: z.string(),
  cheermote: z
    .object({
      prefix: z.string(),
      bits: z.number().int(),
      tier: z.number().int(),
    })
    .nullable(),
  emote: z.null().optional(),
});

export const ChannelBitsUseEventSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  bits: z.number().int(),
  type: z.enum(["cheer", "power_up"]),
  power_up: z.unknown().nullable(),
  custom_power_up: z.unknown().nullable(),
  message: z
    .object({
      text: z.string(),
      fragments: z.array(BitsFragmentSchema),
    })
    .nullable(),
});

export type ChannelBitsUseEvent = z.infer<typeof ChannelBitsUseEventSchema>;

// ─── channel.update ─────────────────────────────────────────────────────────

export const ChannelUpdateEventSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  title: z.string(),
  language: z.string(),
  category_id: z.string(),
  category_name: z.string(),
  content_classification_labels: z.array(z.string()),
});

export type ChannelUpdateEvent = z.infer<typeof ChannelUpdateEventSchema>;

// ─── channel.follow ─────────────────────────────────────────────────────────

export const ChannelFollowEventSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  followed_at: z.string(),
  ...EnrichedUserProfileSchema.shape,
});

export type ChannelFollowEvent = z.infer<typeof ChannelFollowEventSchema>;

// ─── channel.ad_break.begin ─────────────────────────────────────────────────

export const ChannelAdBreakBeginEventSchema = z.object({
  /*
   * Twitch's docs once described these two as strings and this schema followed
   * suit, but they arrive typed: 98 logged ad breaks between Feb and Jun 2026
   * are number/boolean without exception, the Twitch CLI emits them the same
   * way, and both dashboard consumers already read duration_seconds with a
   * `typeof === "number"` check. Declaring them as strings was telling custom
   * widget authors the wrong type.
   */
  duration_seconds: z.number().int(),
  started_at: z.string(),
  is_automatic: z.boolean(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  requester_user_id: z.string(),
  requester_user_login: z.string(),
  requester_user_name: z.string(),
});

export type ChannelAdBreakBeginEvent = z.infer<typeof ChannelAdBreakBeginEventSchema>;

// ─── channel.subscribe ──────────────────────────────────────────────────────

export const ChannelSubscribeEventSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  tier: z.enum(["1000", "2000", "3000"]),
  is_gift: z.boolean(),
  ...EnrichedUserProfileSchema.shape,
});

export type ChannelSubscribeEvent = z.infer<typeof ChannelSubscribeEventSchema>;

// ─── channel.subscription.end ───────────────────────────────────────────────

export const ChannelSubscriptionEndEventSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  tier: z.enum(["1000", "2000", "3000"]),
  is_gift: z.boolean(),
});

export type ChannelSubscriptionEndEvent = z.infer<typeof ChannelSubscriptionEndEventSchema>;

// ─── channel.subscription.gift ──────────────────────────────────────────────

export const ChannelSubscriptionGiftEventSchema = z.object({
  user_id: z.string().nullable(),
  user_login: z.string().nullable(),
  user_name: z.string().nullable(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  total: z.number().int(),
  tier: z.enum(["1000", "2000", "3000"]),
  cumulative_total: z.number().int().nullable(),
  is_anonymous: z.boolean(),
  ...EnrichedUserProfileSchema.shape,
});

export type ChannelSubscriptionGiftEvent = z.infer<typeof ChannelSubscriptionGiftEventSchema>;

// ─── channel.subscription.message ───────────────────────────────────────────

export const ChannelSubscriptionMessageEventSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  tier: z.enum(["1000", "2000", "3000"]),
  message: z.object({
    text: z.string(),
    emotes: z.array(
      z.object({
        begin: z.number().int(),
        end: z.number().int(),
        id: z.string(),
      }),
    ),
  }),
  cumulative_months: z.number().int(),
  streak_months: z.number().int().nullable(),
  duration_months: z.number().int(),
  ...EnrichedUserProfileSchema.shape,
});

export type ChannelSubscriptionMessageEvent = z.infer<typeof ChannelSubscriptionMessageEventSchema>;

// ─── channel.cheer ──────────────────────────────────────────────────────────

export const ChannelCheerEventSchema = z.object({
  is_anonymous: z.boolean(),
  user_id: z.string().nullable(),
  user_login: z.string().nullable(),
  user_name: z.string().nullable(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  message: z.string(),
  bits: z.number().int(),
  ...EnrichedUserProfileSchema.shape,
});

export type ChannelCheerEvent = z.infer<typeof ChannelCheerEventSchema>;

// ─── channel.raid ───────────────────────────────────────────────────────────

export const ChannelRaidEventSchema = z.object({
  from_broadcaster_user_id: z.string(),
  from_broadcaster_user_login: z.string(),
  from_broadcaster_user_name: z.string(),
  to_broadcaster_user_id: z.string(),
  to_broadcaster_user_login: z.string(),
  to_broadcaster_user_name: z.string(),
  viewers: z.number().int(),
  ...EnrichedUserProfileSchema.shape,
});

export type ChannelRaidEvent = z.infer<typeof ChannelRaidEventSchema>;

// ─── channel.ban ────────────────────────────────────────────────────────────

export const ChannelBanEventSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  moderator_user_id: z.string(),
  moderator_user_login: z.string(),
  moderator_user_name: z.string(),
  reason: z.string(),
  banned_at: z.string(),
  ends_at: z.string().nullable(),
  is_permanent: z.boolean(),
});

export type ChannelBanEvent = z.infer<typeof ChannelBanEventSchema>;

// ─── channel.unban ──────────────────────────────────────────────────────────

export const ChannelUnbanEventSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  moderator_user_id: z.string(),
  moderator_user_login: z.string(),
  moderator_user_name: z.string(),
});

export type ChannelUnbanEvent = z.infer<typeof ChannelUnbanEventSchema>;

// ─── channel.unban_request.create ───────────────────────────────────────────

export const ChannelUnbanRequestCreateEventSchema = z.object({
  id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  text: z.string(),
  created_at: z.string(),
});

export type ChannelUnbanRequestCreateEvent = z.infer<typeof ChannelUnbanRequestCreateEventSchema>;

// ─── channel.unban_request.resolve ──────────────────────────────────────────

export const ChannelUnbanRequestResolveEventSchema = z.object({
  id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  moderator_user_id: z.string(),
  moderator_user_login: z.string(),
  moderator_user_name: z.string(),
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  resolution_text: z.string().nullable(),
  status: z.enum(["approved", "denied", "canceled"]),
});

export type ChannelUnbanRequestResolveEvent = z.infer<typeof ChannelUnbanRequestResolveEventSchema>;