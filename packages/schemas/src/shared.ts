import { z } from "zod";

// ─── Reusable primitives ────────────────────────────────────────────────────

export const BadgeSchema = z.object({
  set_id: z.string(),
  id: z.string(),
  info: z.string(),
  // Added by StreamWizard before dispatch, not sent by Twitch. EventSub gives
  // only set_id + version, and the badge image lives behind a Helix lookup with
  // an opaque uuid in the URL, so this is the only way a widget can render the
  // channel's real artwork. `url` is the StreamElements-compatible alias for
  // url_2x, so ported code that does badge.url keeps working.
  //
  // Optional because resolution is cache-only on the dispatch path: a cold
  // cache omits them and fills in the background rather than making a Helix
  // call per chat message. Always guard before use.
  url: z.string().optional(),
  url_1x: z.string().optional(),
  url_2x: z.string().optional(),
  url_4x: z.string().optional(),
});

/**
 * Avatar of the person an event is about, added by StreamWizard before
 * dispatch. No EventSub payload carries one — resolving it needs GET /helix/users.
 *
 * Optional for the same reason as the badge URLs above: cache-only enrichment,
 * so the first event for an unseen user omits it and the next one has it.
 */
export const EnrichedUserProfileSchema = z.object({
  user_profile_image_url: z.string().optional(),
});

export const BroadcasterSchema = z.object({
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
});

export const UserSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
});

export const ModeratorSchema = z.object({
  moderator_user_id: z.string(),
  moderator_user_login: z.string(),
  moderator_user_name: z.string(),
});

export const CurrencyAmountSchema = z.object({
  value: z.number().int(),
  decimal_places: z.number().int(),
  currency: z.string(),
});

export const MessageFragmentSchema = z.object({
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
    })
    .nullable()
    .optional(),
});

export const ChatMessageSchema = z.object({
  text: z.string(),
  fragments: z.array(MessageFragmentSchema),
});

export type Badge = z.infer<typeof BadgeSchema>;
export type Broadcaster = z.infer<typeof BroadcasterSchema>;
export type User = z.infer<typeof UserSchema>;
export type Moderator = z.infer<typeof ModeratorSchema>;
export type CurrencyAmount = z.infer<typeof CurrencyAmountSchema>;
export type MessageFragment = z.infer<typeof MessageFragmentSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;