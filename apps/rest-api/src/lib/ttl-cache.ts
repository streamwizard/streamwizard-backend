/**
 * A bounded per-process TTL cache.
 *
 * Exists because every `/api/nodes/*` request used to cost an uncached Supabase
 * round trip just to resolve the caller's API key — at the node agent's poll
 * rate that was ~45k requests/day against `obs_node_api_keys` alone, and
 * Supabase meters egress per request rather than per byte.
 *
 * Two deliberate choices:
 *
 * - Expiry is lazy (checked on read) rather than swept on an interval, so there
 *   is no timer to leak and no work done for keys nobody asks about again.
 * - Eviction is oldest-insertion-first once `maxEntries` is reached. Close
 *   enough to LRU for entries that all expire anyway, and it bounds memory
 *   against a caller hammering the endpoint with random keys. Same reasoning as
 *   `packages/twitch-assets/src/cache.ts`.
 *
 * Misses are cacheable too (`negativeTtlMs`). Without that, a wrong or revoked
 * key retried in a hot loop is an uncapped Supabase amplifier — the exact
 * failure mode the cache exists to prevent, one tier down.
 */

interface Entry<V> {
  /** `null` is a cached negative result, not an absent entry. */
  value: V | null;
  expiresAt: number;
}

export interface TtlCacheOptions {
  /** How long a successful lookup stays warm. */
  ttlMs: number;
  /** How long a `null` lookup stays warm. Defaults to `ttlMs`. */
  negativeTtlMs?: number;
  maxEntries?: number;
  /** Injectable clock. Tests advance this instead of sleeping. */
  now?: () => number;
}

const DEFAULT_MAX_ENTRIES = 5000;

export class TtlCache<V> {
  private readonly entries = new Map<string, Entry<V>>();
  private readonly inFlight = new Map<string, Promise<V | null>>();
  private readonly ttlMs: number;
  private readonly negativeTtlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  private hits = 0;
  private misses = 0;

  constructor(options: TtlCacheOptions) {
    this.ttlMs = options.ttlMs;
    this.negativeTtlMs = options.negativeTtlMs ?? options.ttlMs;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.now = options.now ?? Date.now;
  }

  /**
   * `undefined` means "not cached, go ask". A cached negative reads back as
   * `null`, which is why this can't just return `V | undefined`.
   */
  get(key: string): V | null | undefined {
    const hit = this.entries.get(key);
    if (!hit) {
      this.misses++;
      return undefined;
    }
    if (hit.expiresAt <= this.now()) {
      this.entries.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return hit.value;
  }

  set(key: string, value: V | null): void {
    if (this.entries.size >= this.maxEntries && !this.entries.has(key)) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
    const ttl = value === null ? this.negativeTtlMs : this.ttlMs;
    this.entries.set(key, { value, expiresAt: this.now() + ttl });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  /**
   * Read-through with stampede protection: N concurrent requests arriving on a
   * cold key produce one `loader()` call, not N. Matters on process start, when
   * every in-flight request misses at once.
   *
   * A throwing `loader` is not cached — the next caller retries. Caching a
   * transient Supabase error for the full TTL would turn a blip into an outage.
   */
  async fetch(key: string, loader: () => Promise<V | null>): Promise<V | null> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const promise = loader()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  /** For the periodic hit-rate log — see how the caches are actually doing. */
  stats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.entries.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
    };
  }
}
