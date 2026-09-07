import type { BadgeMap, CheermoteMap } from "./types";

/**
 * Synchronous URL builders for chat assets. Equivalents of these exist inside
 * the widget iframe runtime (`overlay/lib/widget-srcdoc.ts`), but only as ES5
 * source in a template string — these are the importable versions.
 */

export type BadgeScale = "1x" | "2x" | "4x";

/** An EventSub `badges[]` entry, optionally pre-enriched by the bot. */
export interface ChatBadge {
  set_id: string;
  id: string;
  info?: string;
  url_1x?: string;
  url_2x?: string;
  url_4x?: string;
}

/**
 * The bot enriches badges with their URLs before broadcasting, so the map is
 * only a fallback for events that missed the cache.
 */
export function badgeUrl(
  badge: ChatBadge,
  map: BadgeMap,
  scale: BadgeScale = "2x",
): string | undefined {
  const enriched = badge[`url_${scale}`] ?? badge.url_2x;
  if (enriched) return enriched;

  const version = map[badge.set_id]?.[badge.id];
  if (!version) return undefined;
  return version[`url_${scale}`] ?? version.url_2x;
}

export function badgeTitle(badge: ChatBadge, map: BadgeMap): string {
  return map[badge.set_id]?.[badge.id]?.title ?? badge.set_id;
}

export interface CheermoteUrlOptions {
  theme?: "dark" | "light";
  format?: "animated" | "static";
  scale?: "1" | "1.5" | "2" | "3" | "4";
}

export function cheermoteUrl(
  fragment: { prefix: string; bits: number },
  map: CheermoteMap,
  options: CheermoteUrlOptions = {},
): { url: string; color: string } | undefined {
  const entry = map[fragment.prefix.toLowerCase()];
  if (!entry) return undefined;

  // Tiers are sorted descending, so the first one the cheer covers wins.
  const tier =
    entry.tiers.find((candidate) => fragment.bits >= candidate.min_bits) ??
    entry.tiers[entry.tiers.length - 1];
  if (!tier) return undefined;

  const theme = tier.images[options.theme ?? "dark"] ?? tier.images.dark ?? {};
  const format = theme[options.format ?? "animated"] ?? theme.animated ?? theme.static ?? {};
  const url = format[options.scale ?? "2"] ?? format["2"] ?? format["1"];
  if (!url) return undefined;

  return { url, color: tier.color };
}

/**
 * Twitch emote images are addressed purely by id — no lookup map needed, which
 * is why first-party emotes render correctly before any prefetch has landed.
 */
export function twitchEmoteUrl(emoteId: string, opts: { big?: boolean } = {}): string {
  const scale = opts.big ? "3.0" : "2.0";
  return `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/${scale}`;
}
