/**
 * Shapes handed to widgets. Deliberately flatter than Helix's own: a widget
 * renders a badge from `badges[set_id][version]`, so the maps are keyed for
 * that lookup rather than shipped as arrays the widget has to index itself.
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

/** The only user fields a widget gets. Everything else Helix returns is dropped. */
export interface PublicUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

export interface PublicGame {
  id: string;
  name: string;
  /** Helix template with {width}x{height} placeholders still in it. */
  box_art_url: string;
}

export interface PublicStream {
  is_live: boolean;
  viewer_count: number;
  game_id: string | null;
  game_name: string | null;
  title: string | null;
  started_at: string | null;
  thumbnail_url: string | null;
}

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
