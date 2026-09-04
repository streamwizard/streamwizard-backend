"use client";

/**
 * What the editor knows about a media URL: intrinsic duration and picture
 * size. Probed from a throwaway element and cached per URL for the session.
 * Never stored in the scene: the renderer reads its own element, and a stored
 * length would go stale the moment the file changed.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { releaseMedia } from "@repo/alert-scene/renderer";

export interface MediaInfo {
  /** null when the file never reported a finite length. */
  durationMs: number | null;
  width: number | null;
  height: number | null;
}

export type MediaKind = "video" | "audio";

const PROBE_TIMEOUT_MS = 8000;
const CACHE_LIMIT = 64;

/** undefined = still probing, null = failed or empty. */
type Entry = { value: MediaInfo | null | undefined };
const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function probeMediaInfo(url: string, opts: { kind?: MediaKind; timeoutMs?: number } = {}): Promise<MediaInfo | null> {
  if (typeof document === "undefined" || !url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const el = document.createElement(opts.kind === "audio" ? "audio" : "video");
    let done = false;
    const read = (): MediaInfo => ({
      durationMs: Number.isFinite(el.duration) && el.duration > 0 ? Math.round(el.duration * 1000) : null,
      width: el instanceof HTMLVideoElement && el.videoWidth > 0 ? el.videoWidth : null,
      height: el instanceof HTMLVideoElement && el.videoHeight > 0 ? el.videoHeight : null,
    });
    const finish = (info: MediaInfo | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onDuration);
      el.removeEventListener("error", onError);
      releaseMedia(el);
      resolve(info);
    };
    const onDuration = () => {
      if (Number.isFinite(el.duration)) finish(read());
    };
    const onMeta = () => {
      if (Number.isFinite(el.duration)) {
        finish(read());
        return;
      }
      // A streamed WebM reports Infinity until the element is pushed to its end.
      el.addEventListener("durationchange", onDuration);
      try {
        el.currentTime = 1e101;
      } catch {
        finish(read());
      }
    };
    const onError = () => finish(null);
    // Whatever arrived by then: a size without a length still helps.
    const timer = setTimeout(() => finish(el.readyState >= 1 ? read() : null), opts.timeoutMs ?? PROBE_TIMEOUT_MS);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("error", onError);
    el.preload = "metadata";
    el.muted = true;
    el.src = url;
  });
}

function trimCache(): void {
  if (cache.size <= CACHE_LIMIT) return;
  for (const [key, entry] of cache) {
    if (entry.value === undefined) continue;
    cache.delete(key);
    if (cache.size <= CACHE_LIMIT) return;
  }
}

/** Probes once per URL; later calls share the answer. */
export function loadMediaInfo(url: string, kind: MediaKind = "video"): Promise<MediaInfo | null> {
  if (!url) return Promise.resolve(null);
  const hit = cache.get(url);
  if (hit && hit.value !== undefined) return Promise.resolve(hit.value);
  if (hit) return waitFor(url);
  const entry: Entry = { value: undefined };
  cache.set(url, entry);
  trimCache();
  return probeMediaInfo(url, { kind }).then((info) => {
    entry.value = info;
    notify();
    return info;
  });
}

function waitFor(url: string): Promise<MediaInfo | null> {
  return new Promise((resolve) => {
    const check = () => {
      const entry = cache.get(url);
      if (!entry || entry.value === undefined) return;
      listeners.delete(check);
      resolve(entry.value);
    };
    listeners.add(check);
  });
}

/** Synchronous view of the cache: undefined while probing (or never asked), null when it failed. */
export function readMediaInfo(url: string): MediaInfo | null | undefined {
  if (!url) return null;
  return cache.get(url)?.value;
}

/** Same contract as readMediaInfo, and starts the probe on first use. */
export function useMediaInfo(url: string, kind: MediaKind = "video"): MediaInfo | null | undefined {
  useEffect(() => {
    if (url) void loadMediaInfo(url, kind);
  }, [url, kind]);
  const get = useCallback(() => readMediaInfo(url), [url]);
  return useSyncExternalStore(subscribe, get, () => undefined);
}
