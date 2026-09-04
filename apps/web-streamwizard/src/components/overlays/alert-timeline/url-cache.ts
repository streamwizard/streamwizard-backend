"use client";

/**
 * A per-URL answer cache with one probe in flight per URL, for things the
 * editor learns about a file (its length, its waveform) and never stores.
 * The React side is useSyncExternalStore, so readers get the cached object
 * itself: undefined while probing, null when the probe failed.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";

export interface UrlCache<T, H> {
  load(url: string, hint: H): Promise<T | null>;
  read(url: string): T | null | undefined;
  subscribe(listener: () => void): () => void;
}

export function createUrlCache<T, H = undefined>(probe: (url: string, hint: H) => Promise<T | null>, limit = 64): UrlCache<T, H> {
  type Entry = { value: T | null | undefined };
  const cache = new Map<string, Entry>();
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  // Oldest settled entries go first; a probe in flight keeps its slot.
  const trim = () => {
    if (cache.size <= limit) return;
    for (const [key, entry] of cache) {
      if (entry.value === undefined) continue;
      cache.delete(key);
      if (cache.size <= limit) return;
    }
  };

  const waitFor = (url: string): Promise<T | null> =>
    new Promise((resolve) => {
      const check = () => {
        const entry = cache.get(url);
        if (!entry || entry.value === undefined) return;
        listeners.delete(check);
        resolve(entry.value);
      };
      listeners.add(check);
    });

  const load = (url: string, hint: H): Promise<T | null> => {
    if (!url) return Promise.resolve(null);
    const hit = cache.get(url);
    if (hit) return hit.value === undefined ? waitFor(url) : Promise.resolve(hit.value);
    const entry: Entry = { value: undefined };
    cache.set(url, entry);
    trim();
    return probe(url, hint)
      .catch(() => null)
      .then((value) => {
        entry.value = value;
        notify();
        return value;
      });
  };

  const read = (url: string): T | null | undefined => (url ? cache.get(url)?.value : null);

  return { load, read, subscribe };
}

/** Reads the cached answer for `url` and starts the probe on first use. */
export function useUrlCache<T, H>(cache: UrlCache<T, H>, url: string, hint: H): T | null | undefined {
  useEffect(() => {
    if (url) void cache.load(url, hint);
  }, [cache, url, hint]);
  const get = useCallback(() => cache.read(url), [cache, url]);
  return useSyncExternalStore(cache.subscribe, get, () => undefined);
}
