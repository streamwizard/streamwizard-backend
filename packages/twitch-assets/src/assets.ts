import { TwitchApi } from "@repo/twitch-api";
import { ASSET_TTL, getCached, peekCached, peekMemory, setCached, singleFlight } from "./cache";
import type {
  BadgeMap,
  CheermoteMap,
  PublicGame,
  PublicUser,
} from "./types";

/**
 * Class A: assets. Content-addressed, effectively immutable, safe to cache.
 * Every function here has a `resolve` form (fetch on miss) and, where the hot
 * path needs it, a `peek` form that is cache-only.
 */

const keys = {
  globalBadges: () => "badges:global",
  channelBadges: (broadcasterId: string) => `badges:${broadcasterId}`,
  cheermotes: (broadcasterId: string) => `cheermotes:${broadcasterId}`,
  user: (userId: string) => `user:${userId}`,
  game: (gameId: string) => `game:${gameId}`,
};

// ---------------------------------------------------------------- badges

function badgesToMap(sets: { set_id: string; versions: Array<{ id: string; image_url_1x: string; image_url_2x: string; image_url_4x: string; title: string; description: string }> }[]): BadgeMap {
  const map: BadgeMap = {};
  for (const set of sets) {
    const versions: Record<string, BadgeMap[string][string]> = {};
    for (const v of set.versions) {
      versions[v.id] = {
        url_1x: v.image_url_1x,
        url_2x: v.image_url_2x,
        url_4x: v.image_url_4x,
        title: v.title,
        description: v.description,
      };
    }
    map[set.set_id] = versions;
  }
  return map;
}

async function resolveGlobalBadges(): Promise<BadgeMap> {
  const key = keys.globalBadges();
  const cached = await getCached<BadgeMap>(key);
  if (cached) return cached;

  return singleFlight(key, async () => {
    const sets = await new TwitchApi(null).chat.getGlobalBadges();
    const map = badgesToMap(sets);
    await setCached(key, map, ASSET_TTL.globalBadges);
    return map;
  });
}

async function resolveChannelBadges(broadcasterId: string): Promise<BadgeMap> {
  const key = keys.channelBadges(broadcasterId);
  const cached = await getCached<BadgeMap>(key);
  if (cached) return cached;

  return singleFlight(key, async () => {
    const sets = await new TwitchApi(broadcasterId).chat.getChannelBadges();
    const map = badgesToMap(sets);
    await setCached(key, map, ASSET_TTL.channelBadges);
    return map;
  });
}

/**
 * Global badges with the channel's own layered on top — a channel that ships
 * custom subscriber artwork must win, since matching that artwork is the whole
 * reason a widget can't just draw its own moderator shield.
 *
 * Merged per set_id, not deep: a channel's `subscriber` set replaces the global
 * one wholesale, which is how Twitch itself treats it.
 */
export async function resolveBadges(broadcasterId: string): Promise<BadgeMap> {
  const [global, channel] = await Promise.all([
    resolveGlobalBadges(),
    resolveChannelBadges(broadcasterId),
  ]);
  return { ...global, ...channel };
}

/**
 * Cache-only. Undefined until *both* halves are warm.
 *
 * Both, not either: a channel with no custom badges caches a legitimate `{}`,
 * so "channel warm, global cold" would otherwise return a truthy near-empty
 * map — every badge silently resolving to nothing, and no warm triggered
 * because the map looked like a hit.
 */
export function peekBadges(broadcasterId: string): BadgeMap | undefined {
  const global = peekMemory<BadgeMap>(keys.globalBadges());
  const channel = peekMemory<BadgeMap>(keys.channelBadges(broadcasterId));
  if (!global || !channel) return undefined;
  return { ...global, ...channel };
}

/** Same contract as {@link peekBadges}, but reads the Supabase tier too. */
export async function peekBadgesCached(broadcasterId: string): Promise<BadgeMap | undefined> {
  const [global, channel] = await Promise.all([
    peekCached<BadgeMap>(keys.globalBadges()),
    peekCached<BadgeMap>(keys.channelBadges(broadcasterId)),
  ]);
  if (!global || !channel) return undefined;
  return { ...global, ...channel };
}

/** Fire-and-forget warm, for the enrichment path's background fill. */
export function warmBadges(broadcasterId: string): void {
  void resolveBadges(broadcasterId).catch(() => {});
}

// ------------------------------------------------------------ cheermotes

export async function resolveCheermotes(broadcasterId: string): Promise<CheermoteMap> {
  const key = keys.cheermotes(broadcasterId);
  const cached = await getCached<CheermoteMap>(key);
  if (cached) return cached;

  return singleFlight(key, async () => {
    const cheermotes = await new TwitchApi(broadcasterId).bits.getCheermotes();
    const map: CheermoteMap = {};
    for (const c of cheermotes) {
      map[c.prefix.toLowerCase()] = {
        prefix: c.prefix,
        // Descending so "first tier whose min_bits <= amount" is the match.
        tiers: [...c.tiers]
          .sort((a, b) => b.min_bits - a.min_bits)
          .map((t) => ({ min_bits: t.min_bits, id: t.id, color: t.color, images: t.images })),
      };
    }
    await setCached(key, map, ASSET_TTL.cheermotes);
    return map;
  });
}

export function peekCheermotes(broadcasterId: string): CheermoteMap | undefined {
  return peekMemory<CheermoteMap>(keys.cheermotes(broadcasterId));
}

export function warmCheermotes(broadcasterId: string): void {
  void resolveCheermotes(broadcasterId).catch(() => {});
}

// ----------------------------------------------------------------- users

function toPublicUser(u: { id: string; login: string; display_name: string; profile_image_url: string }): PublicUser {
  return {
    id: u.id,
    login: u.login,
    display_name: u.display_name,
    profile_image_url: u.profile_image_url,
  };
}

/**
 * Cached per user, fetched in batches of 100. Ids already in cache never reach
 * Helix, so a chat widget resolving avatars for a busy channel converges on
 * zero upstream calls.
 */
export async function resolveUsers(userIds: string[]): Promise<Record<string, PublicUser>> {
  const unique = [...new Set(userIds)];
  const out: Record<string, PublicUser> = {};
  const missing: string[] = [];

  await Promise.all(
    unique.map(async (id) => {
      const cached = await getCached<PublicUser>(keys.user(id));
      if (cached) out[id] = cached;
      else missing.push(id);
    })
  );

  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100);
    const users = await new TwitchApi(null).search.lookupUsers(chunk);
    await Promise.all(
      users.map(async (u) => {
        const publicUser = toPublicUser(u);
        out[u.id] = publicUser;
        await setCached(keys.user(u.id), publicUser, ASSET_TTL.user);
      })
    );
  }

  return out;
}

export async function resolveUser(userId: string): Promise<PublicUser | undefined> {
  const users = await resolveUsers([userId]);
  return users[userId];
}

export function peekUser(userId: string): PublicUser | undefined {
  return peekMemory<PublicUser>(keys.user(userId));
}

/** Same contract as {@link peekUser}, but reads the Supabase tier too. */
export function peekUserCached(userId: string): Promise<PublicUser | undefined> {
  return peekCached<PublicUser>(keys.user(userId));
}

/**
 * Background fill for the enrichment path.
 *
 * Batched on purpose: chat introduces new chatters one message at a time, and
 * warming each one immediately would trade "a Helix call per event" for "a
 * Helix call per new chatter" — the same storm wearing a different hat. Ids
 * collect for a short window and go out as one lookup of up to 100.
 */
const WARM_WINDOW_MS = 250;
/**
 * Ids Helix declined to return (banned, deleted, renamed) would otherwise be
 * re-queued on every message that user ever sent. Remember the attempt for a
 * while so a missing account costs one lookup, not one per message.
 */
const WARM_RETRY_MS = 10 * 60 * 1000;
const warmQueue = new Set<string>();
const warmAttempted = new Map<string, number>();
let warmTimer: ReturnType<typeof setTimeout> | undefined;

function flushWarmQueue(): void {
  warmTimer = undefined;

  const cutoff = Date.now() - WARM_RETRY_MS;
  for (const [id, at] of warmAttempted) {
    if (at < cutoff) warmAttempted.delete(id);
  }

  const ids = [...warmQueue].slice(0, 100);
  ids.forEach((id) => warmQueue.delete(id));
  if (ids.length === 0) return;

  void resolveUsers(ids)
    .catch(() => {})
    .finally(() => {
      // More arrived while that was in flight, or the batch was capped at 100.
      if (warmQueue.size > 0 && !warmTimer) {
        warmTimer = setTimeout(flushWarmQueue, WARM_WINDOW_MS);
        warmTimer.unref?.();
      }
    });
}

export function warmUser(userId: string): void {
  if (peekUser(userId)) return;

  const attemptedAt = warmAttempted.get(userId);
  if (attemptedAt !== undefined && Date.now() - attemptedAt < WARM_RETRY_MS) return;
  warmAttempted.set(userId, Date.now());

  warmQueue.add(userId);
  if (!warmTimer) {
    warmTimer = setTimeout(flushWarmQueue, WARM_WINDOW_MS);
    warmTimer.unref?.();
  }
}

// ----------------------------------------------------------------- games

export async function resolveGame(gameId: string): Promise<PublicGame | undefined> {
  const key = keys.game(gameId);
  const cached = await getCached<PublicGame>(key);
  if (cached) return cached;

  return singleFlight(key, async () => {
    const game = await new TwitchApi(null).search.lookupGame(gameId);
    if (!game) return undefined;
    const publicGame: PublicGame = { id: game.id, name: game.name, box_art_url: game.box_art_url };
    await setCached(key, publicGame, ASSET_TTL.game);
    return publicGame;
  });
}
