import { z } from "zod";

/**
 *
 * STREAM
 */

export const StreamOfflineSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
});

export type StreamOfflineEvent = z.infer<typeof StreamOfflineSchema>;

export const StreamOnlineSchema = z.object({
  id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  type: z.string(),
  started_at: z.string(),
});

export type StreamOnlineEvent = z.infer<typeof StreamOnlineSchema>;

/**
 *
 * channelpoints
 */

// channel_points_custom_reward_redemption.add
export const ChannelPointsCustomRewardRedemptionAddSchema = z.object({
  id: z.string().uuid(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  user_input: z.string(),
  status: z.enum(["unfulfilled", "fulfilled", "canceled"]),
  reward: z.object({
    id: z.string().uuid(),
    title: z.string(),
    cost: z.number().int().positive(),
    prompt: z.string(),
  }),
  redeemed_at: z.string().datetime(),
});

export type ChannelPointsCustomRewardRedemptionAddEvent = z.infer<typeof ChannelPointsCustomRewardRedemptionAddSchema>;

/**
 * Chat
 */

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
    fragments: z.array(
      z.object({
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
            owner_id: z.string(),
            format: z.array(z.enum(["animated", "static"])),
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
      }),
    ),
  }),
  color: z.string(),
  badges: z.array(
    z.object({
      set_id: z.string(),
      id: z.string(),
      info: z.string(),
    }),
  ),
  message_type: z.enum([
    "text",
    "channel_points_highlighted",
    "channel_points_sub_only",
    "user_intro",
    "power_ups_message_effect",
    "power_ups_gigantified_emote",
  ]),
  cheer: z
    .object({
      bits: z.number().int(),
    })
    .nullable()
    .optional(),
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
  source_badges: z
    .array(
      z.object({
        set_id: z.string(),
        id: z.string(),
        info: z.string(),
      }),
    )
    .nullable()
    .optional(),
  is_source_only: z.boolean().nullable().optional(),
});

export type ChannelChatMessageEvent = z.infer<typeof ChannelChatMessageEventSchema>;

/**
 *
 * channel
 */

// channel.update
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
