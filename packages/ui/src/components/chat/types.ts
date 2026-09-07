/**
 * Types for rendering a Twitch chat message.
 *
 * The asset map shapes are declared here rather than imported from
 * `@repo/twitch-assets`: that package pulls in `@repo/supabase` and
 * `@repo/twitch-api`, i.e. service-key server code, which has no business in a
 * component library. They are the same shapes the asset API serves, which is
 * also the contract widgets already code against.
 */

export interface BadgeImage {
  url_1x: string;
  url_2x: string;
  url_4x: string;
  title: string;
  description: string;
}

/** set_id → version → image. Channel badges override global ones. */
export type BadgeMap = Record<string, Record<string, BadgeImage>>;

export interface CheermoteTier {
  min_bits: number;
  id: string;
  color: string;
  /** theme → format → scale → url, straight from Helix. */
  images: Record<string, Record<string, Record<string, string>>>;
}

/** Lowercased prefix → tiers, sorted by min_bits descending. */
export type CheermoteMap = Record<string, { prefix: string; tiers: CheermoteTier[] }>;

export type ThirdPartyProvider = "7tv" | "bttv" | "ffz";

export interface ThirdPartyEmote {
  id: string;
  name: string;
  provider: ThirdPartyProvider;
  url_1x: string;
  url_2x: string;
  url_4x: string;
}

/** Emote code → emote. Codes are case-sensitive, as chat matches them. */
export type ThirdPartyEmoteMap = Record<string, ThirdPartyEmote>;

/**
 * Everything a message needs to render synchronously. Fetched once per session
 * and passed down whole, so no row ever awaits anything mid-render.
 */
export interface ChatAssets {
  badges: BadgeMap;
  cheermotes: CheermoteMap;
  thirdPartyEmotes: ThirdPartyEmoteMap;
}

export const EMPTY_CHAT_ASSETS: ChatAssets = {
  badges: {},
  cheermotes: {},
  thirdPartyEmotes: {},
};

/** One EventSub message fragment. Structurally `ChatFragment` from @repo/schemas. */
export interface ChatFragment {
  type: "text" | "cheermote" | "emote" | "mention";
  text: string;
  cheermote?: { prefix: string; bits: number; tier: number } | null;
  emote?: { id: string; emote_set_id: string } | null;
  mention?: { user_id: string; user_name: string; user_login: string } | null;
}

export type ChatToken =
  | { kind: "text"; text: string }
  | {
      kind: "emote";
      /** The code, used as the alt text and the tooltip. */
      name: string;
      url: string;
      provider: ThirdPartyProvider | "twitch";
      /** Power-up gigantified emotes render at a larger size than the rest. */
      big?: boolean;
    }
  | { kind: "cheermote"; prefix: string; bits: number; url?: string; color?: string }
  | { kind: "mention"; text: string; userId?: string; isBroadcaster: boolean }
  | { kind: "link"; text: string; href: string };

export interface ChatRenderOptions {
  /** Highlights mentions of the channel owner. */
  broadcasterUserId?: string;
  /** Set for `power_ups_gigantified_emote` messages. */
  gigantified?: boolean;
}
