import { supabase } from "@repo/supabase";
import { selectCachedAsset, upsertCachedAsset } from "@repo/supabase/queries/asset-cache";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Every cacheable resource and how long a stale answer stays acceptable.
 *
 * Note what is NOT here: follower totals, subscriber totals and stream state.
 * Those are live counters — a goal widget that comes back from a refresh
 * showing a cached number is showing a wrong number. They go through
 * `singleFlight` instead, which collapses concurrent callers without ever
 * storing a value. See the migration comment for the same warning.
 */
export const ASSET_TTL = {
  globalBadges: DAY,
  channelBadges: HOUR,
  cheermotes: DAY,
  user: 6 * HOUR,
  game: 7 * DAY,
  thirdPartyEmotes: HOUR,
} as const;

export type AssetKind = keyof typeof ASSET_TTL;

/**
 * Per-process layer in front of Supabase. Without it a chat burst is one DB
 * round trip per message even on a warm cache. Bounded so a long-running bot
 * seeing thousands of chatters doesn't grow without limit; eviction is oldest
 * insertion first, which is close enough to LRU for a cache whose entries all
 * expire anyway.
 */
const MEMORY_MAX_ENTRIES = 5000;
const memory = new Map<string, { payload: unknown; expiresAt: number }>();

function memoryGet(key: string): unknown | undefined {
  const hit = memory.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    memory.delete(key);
    return undefined;
  }
  return hit.payload;
}

function memorySet(key: string, payload: unknown, expiresAt: number): void {
  if (memory.size >= MEMORY_MAX_ENTRIES) {
    const oldest = memory.keys().next();
    if (!oldest.done) memory.delete(oldest.value);
  }
  memory.set(key, { payload, expiresAt });
}

/** Memory, then Supabase. Expired rows read as a miss. */
export async function getCached<T>(key: string): Promise<T | undefined> {
  const local = memoryGet(key);
  if (local !== undefined) return local as T;

  const { data, error } = await selectCachedAsset(supabase, key);

  // A cache read failure must degrade to a miss, never throw into a render
  // path — worst case we make one extra Helix call.
  if (error || !data) return undefined;

  memorySet(key, data.payload, new Date(data.expires_at).getTime());
  return data.payload as T;
}

export async function setCached(key: string, payload: unknown, ttlMs: number): Promise<void> {
  const expiresAt = Date.now() + ttlMs;
  memorySet(key, payload, expiresAt);

  const { error } = await upsertCachedAsset(supabase, { cacheKey: key, payload, expiresAt });

  // Same reasoning as above: the memory layer already has it, so a failed
  // write costs an extra fetch later, not a broken response now.
  if (error) console.error("[twitch-assets] cache write failed", key, error.message);
}

/** Cache-only read. Never touches Supabase or Helix — used by the hot path. */
export function peekMemory<T>(key: string): T | undefined {
  return memoryGet(key) as T | undefined;
}

/**
 * Keys the DB missed too. Without this an uncached chatter costs a round trip
 * on every message they send until the background warm lands — the same
 * per-message storm the memory layer exists to prevent, one tier down.
 */
const DB_MISS_TTL = 30 * SECOND;
const dbMisses = new Map<string, number>();

/**
 * Memory, then Supabase. Never Helix.
 *
 * The enrichment path's read. `peekMemory` alone means a restarted process
 * ignores rows that are still warm in `twitch_asset_cache`, re-opening a full
 * cold window on every deploy; this reads that tier without ever reaching for
 * an upstream call the hot path can't afford.
 */
export async function peekCached<T>(key: string): Promise<T | undefined> {
  const local = memoryGet(key);
  if (local !== undefined) return local as T;

  const missedAt = dbMisses.get(key);
  if (missedAt !== undefined) {
    if (Date.now() - missedAt < DB_MISS_TTL) return undefined;
    dbMisses.delete(key);
  }

  // Prefixed so this never joins a resolve*() flight for the same key — that
  // promise can be waiting on Helix, which is exactly what this must not do.
  const hit = await singleFlight(`peek:${key}`, () => getCached<T>(key));
  if (hit === undefined) {
    // Same bound as the memory layer: a channel full of one-message chatters
    // must not grow this map forever.
    if (dbMisses.size >= MEMORY_MAX_ENTRIES) {
      const cutoff = Date.now() - DB_MISS_TTL;
      for (const [k, at] of dbMisses) if (at < cutoff) dbMisses.delete(k);
      if (dbMisses.size >= MEMORY_MAX_ENTRIES) dbMisses.clear();
    }
    dbMisses.set(key, Date.now());
  }
  return hit;
}

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Collapses concurrent identical work into one call. Used two ways:
 * for assets it stops a cold cache from firing N identical Helix requests,
 * and for live counters it is the *entire* stampede defence — 500 viewers
 * reloading an overlay become one request, with nothing persisted, so the
 * number every one of them gets is fresh rather than merely recent.
 */
export function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise as Promise<T>;
}
