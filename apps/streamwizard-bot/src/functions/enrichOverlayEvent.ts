import {
  peekBadgesCached,
  peekUserCached,
  warmBadges,
  warmUser,
  type BadgeMap,
} from "@repo/twitch-assets";

/**
 * Adds the presentation fields EventSub leaves out, so the common cases render
 * without the widget fetching anything.
 *
 * Two rules keep this safe:
 *
 * 1. Cache-only: memory, then the Supabase cache tier, never Helix. A miss
 *    omits the field and kicks off a background fill, so the next event has
 *    it. Chat volume therefore cannot turn into a Helix storm no matter how
 *    busy the channel is. Reading the Supabase tier matters because the
 *    memory layer is per-process: without it every deploy re-opens a full
 *    cold window over rows that are still warm in the table.
 *
 * 2. Additive only. Nothing existing is mutated or removed, so widgets reading
 *    `badges[].set_id` / `.id` / `.info` keep working untouched.
 *
 * Deliberately absent: follower and subscriber totals. A count attached to an
 * event is stale the moment it is serialised, and would compete with the
 * widget's own authoritative read. Those stay pull-only.
 */

/** EventSub badge entry, plus the fields we add. */
interface EnrichedBadge {
  set_id: string;
  id: string;
  info?: string;
  /** StreamElements-compatible alias for url_2x — ported code does badge.url. */
  url?: string;
  url_1x?: string;
  url_2x?: string;
  url_4x?: string;
}

function enrichBadges(badges: unknown, map: BadgeMap): unknown {
  if (!Array.isArray(badges)) return badges;

  return badges.map((badge: EnrichedBadge) => {
    const version = map[badge.set_id]?.[badge.id];
    if (!version) return badge;
    return {
      ...badge,
      url: version.url_2x,
      url_1x: version.url_1x,
      url_2x: version.url_2x,
      url_4x: version.url_4x,
    };
  });
}

/**
 * Event types that get an avatar. Kept as an explicit list rather than "any
 * event with a user_id" so the runtime shape matches the zod schemas exactly —
 * an author's autocomplete and the payload they actually receive must agree,
 * or the field is just another undocumented surprise.
 */
const AVATAR_EVENTS = new Set([
  "channel.follow",
  "channel.subscribe",
  "channel.subscription.gift",
  "channel.subscription.message",
  "channel.cheer",
  "channel.raid",
  "channel.chat.message",
  "channel.chat.notification",
]);

/**
 * Events whose `user_id` is the person the alert is about. Raids are the
 * exception: the interesting party is the incoming broadcaster, under a
 * different key.
 */
const USER_ID_KEYS = ["user_id", "chatter_user_id", "from_broadcaster_user_id"] as const;

function subjectUserId(event: Record<string, unknown>): string | undefined {
  for (const key of USER_ID_KEYS) {
    const value = event[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

/**
 * The cache tier lives across the network, so a lookup can hang. A chat message
 * that arrives late is worse than one that arrives without an avatar — the
 * widget resolves what's missing itself — so a slow read loses to the clock.
 */
const LOOKUP_TIMEOUT_MS = 150;

function withinBudget<T>(promise: Promise<T>): Promise<T | undefined> {
  return Promise.race([
    promise.catch(() => undefined),
    new Promise<undefined>((resolve) => {
      const timer = setTimeout(() => resolve(undefined), LOOKUP_TIMEOUT_MS);
      timer.unref?.();
    }),
  ]);
}

export async function enrichOverlayEvent(
  broadcasterId: string,
  eventType: string,
  payload: unknown
): Promise<unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;

  const event = payload as Record<string, unknown>;
  const userId = AVATAR_EVENTS.has(eventType) ? subjectUserId(event) : undefined;

  // Both lookups together: they're independent, and serialising them would
  // spend the budget twice for one event.
  const [badgeMap, user] = await Promise.all([
    Array.isArray(event.badges) ? withinBudget(peekBadgesCached(broadcasterId)) : undefined,
    userId ? withinBudget(peekUserCached(userId)) : undefined,
  ]);

  let enriched: Record<string, unknown> | undefined;
  const mutate = () => (enriched ??= { ...event });

  if (Array.isArray(event.badges)) {
    if (badgeMap) mutate().badges = enrichBadges(event.badges, badgeMap);
    else warmBadges(broadcasterId);
  }

  if (userId) {
    if (user) mutate().user_profile_image_url = user.profile_image_url;
    else warmUser(userId);
  }

  return enriched ?? event;
}
