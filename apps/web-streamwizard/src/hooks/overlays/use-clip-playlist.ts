"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { PreviewClip } from "@/actions/overlays-preview";
import { getPreviewClips } from "@/actions/overlays-preview";
import { DEFAULT_CLIPS_WIDGET_CONFIG, type ClipsWidgetConfig } from "@/types/overlays";
import { createPlaybackOrder } from "@/lib/clip-playback-order";
import type { EditorClipPlaybackControls } from "@/components/overlays/registry/overlay-widget-registry.types";

interface ResolvedClip extends PreviewClip {
  videoUrl?: string;
  resolving?: boolean;
  failed?: boolean;
}

/**
 * The clips widget's playback engine: which clips are in the pool, what order
 * they play in, and the two <video> elements they crossfade between.
 *
 * Two players exist so the next clip can be loaded and seeked while the current
 * one is still on screen — a single element would show a black frame on every
 * transition. The caller renders them; everything about *when* they play lives
 * here.
 */
export function useClipPlaylist({
  config,
  editorClipPlayback,
}: {
  config: ClipsWidgetConfig;
  editorClipPlayback?: EditorClipPlaybackControls;
}) {
  const [clips, setClips] = useState<ResolvedClip[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playOrder, setPlayOrder] = useState<number[]>([]);
  const [orderPosition, setOrderPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activePlayer, setActivePlayer] = useState<0 | 1>(0);
  const isRandomMode = config.sort === "random";

  const previewEditor = editorClipPlayback != null;

  const persistedMuted =
    config.clipMuted ?? DEFAULT_CLIPS_WIDGET_CONFIG.clipMuted;
  const volume = config.clipVolume ?? 1;
  // Outside the editor there is no mute control, so the widget's own setting wins.
  const muted = previewEditor
    ? editorClipPlayback.previewForceMute || persistedMuted
    : persistedMuted;

  const mediaShouldPlay = previewEditor
    ? !editorClipPlayback.previewPaused && isPlaying
    : isPlaying;

  const clipQueryKey = useMemo(
    () =>
      JSON.stringify({
        sourceMode: config.sourceMode,
        folderIds: config.folderIds,
        gameIds: config.gameIds,
        creatorIds: config.creatorIds,
        timeWindow: config.timeWindow,
        customDateRange: config.customDateRange,
        sort: config.sort,
        minViewCount: config.minViewCount,
        isFeaturedOnly: config.isFeaturedOnly,
      }),
    [
      config.sourceMode,
      config.folderIds,
      config.gameIds,
      config.creatorIds,
      config.timeWindow,
      config.customDateRange,
      config.sort,
      config.minViewCount,
      config.isFeaturedOnly,
    ]
  );

  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);
  const urlCacheRef = useRef<Record<string, string>>({});
  const urlFetchInFlightRef = useRef<Set<string>>(new Set());
  const clipCrossfadeMs = useMemo(() => {
    const mode =
      config.clipTransition ?? DEFAULT_CLIPS_WIDGET_CONFIG.clipTransition;
    if (mode !== "crossfade") return 0;
    const raw =
      config.clipTransitionMs ?? DEFAULT_CLIPS_WIDGET_CONFIG.clipTransitionMs;
    return Math.min(3000, Math.max(200, raw));
  }, [config.clipTransition, config.clipTransitionMs]);

  const videoOpacityTransitionStyle = useMemo(
    () =>
      ({
        transitionProperty: "opacity",
        transitionDuration:
          clipCrossfadeMs > 0 ? `${clipCrossfadeMs}ms` : "0ms",
        transitionTimingFunction: "ease-in-out",
      }) satisfies CSSProperties,
    [clipCrossfadeMs]
  );

  useEffect(() => {
    const a = videoRefA.current;
    const b = videoRefB.current;
    if (!a || !b) return;

    const pauseHidden = () => {
      if (activePlayer === 0) b.pause();
      else a.pause();
    };

    if (clipCrossfadeMs <= 0) {
      pauseHidden();
      return;
    }

    const id = window.setTimeout(pauseHidden, clipCrossfadeMs);
    return () => window.clearTimeout(id);
  }, [activePlayer, clipCrossfadeMs]);

  const getActiveRef = useCallback(
    () => (activePlayer === 0 ? videoRefA : videoRefB),
    [activePlayer]
  );
  const getInactiveRef = useCallback(
    () => (activePlayer === 0 ? videoRefB : videoRefA),
    [activePlayer]
  );

  const prevEditorPreviewPausedRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!editorClipPlayback) {
      prevEditorPreviewPausedRef.current = null;
      return;
    }

    const paused = editorClipPlayback.previewPaused;
    const prev = prevEditorPreviewPausedRef.current;
    prevEditorPreviewPausedRef.current = paused;

    if (paused) {
      setIsPlaying(false);
    } else if (prev === true && paused === false) {
      // Header or "Allow playback" lifted editor pause — resume local play intent.
      setIsPlaying(true);
    }
  }, [editorClipPlayback?.previewPaused]);

  useEffect(() => {
    const a = videoRefA.current;
    const b = videoRefB.current;
    if (!a || !b) return;

    if (mediaShouldPlay) {
      const active = activePlayer === 0 ? a : b;
      active.play().catch((err) => {
        if (
          previewEditor &&
          err instanceof DOMException &&
          err.name === "NotAllowedError"
        ) {
          editorClipPlayback?.setAutoplayBlocked(true);
        }
      });
    } else {
      a.pause();
      b.pause();
    }
  }, [
    mediaShouldPlay,
    activePlayer,
    previewEditor,
    editorClipPlayback,
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    urlCacheRef.current = {};
    urlFetchInFlightRef.current.clear();

    getPreviewClips(config).then((result) => {
      if (cancelled) return;
      const nextClips = result.clips.map((c) => ({ ...c }));
      const nextOrder = createPlaybackOrder(nextClips.length, config.sort === "random");

      setClips(nextClips);
      setPlayOrder(nextOrder);
      setOrderPosition(0);
      setCurrentIndex(nextOrder[0] ?? 0);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [clipQueryKey]);

  const resolveClipUrl = useCallback(
    async (clip: ResolvedClip): Promise<string | null> => {
      if (clip.videoUrl) return clip.videoUrl;
      if (clip.failed) return null;
      const cachedUrl = urlCacheRef.current[clip.twitch_clip_id];
      if (cachedUrl) return cachedUrl;

      try {
        const res = await fetch("/api/overlays/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clipId: clip.twitch_clip_id,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error("Failed to fetch clip URL:", res.status, res.statusText, errorText);
          return null;
        }

        const data = await res.json();
        const signedUrl = data.landscape_url;
        if (!signedUrl) return null;

        const proxiedUrl = `/api/overlays/preview/stream?url=${encodeURIComponent(signedUrl)}`;
        urlCacheRef.current[clip.twitch_clip_id] = proxiedUrl;
        return proxiedUrl;
      } catch {
        return null;
      }
    },
    []
  );

  const loadClipIntoPlayer = useCallback(
    async (index: number, videoRef: React.RefObject<HTMLVideoElement | null>) => {
      if (index < 0 || index >= clips.length || !videoRef.current) return false;

      const clip = clips[index];
      const url = await resolveClipUrl(clip);

      if (!url) {
        setClips((prev) =>
          prev.map((c, i) => (i === index ? { ...c, failed: true } : c))
        );
        return false;
      }

      setClips((prev) =>
        prev.map((c, i) => (i === index ? { ...c, videoUrl: url } : c))
      );

      videoRef.current.src = url;
      videoRef.current.load();
      return true;
    },
    [clips, resolveClipUrl]
  );

  const prefetchClipUrl = useCallback(
    async (index: number) => {
      if (index < 0 || index >= clips.length) return;
      const clip = clips[index];
      if (!clip || clip.failed || clip.videoUrl) return;

      if (urlCacheRef.current[clip.twitch_clip_id]) {
        setClips((prev) =>
          prev.map((c, i) =>
            i === index ? { ...c, videoUrl: urlCacheRef.current[clip.twitch_clip_id] } : c
          )
        );
        return;
      }

      if (urlFetchInFlightRef.current.has(clip.twitch_clip_id)) return;
      urlFetchInFlightRef.current.add(clip.twitch_clip_id);

      try {
        const url = await resolveClipUrl(clip);
        if (!url) return;

        setClips((prev) =>
          prev.map((c, i) => (i === index ? { ...c, videoUrl: url } : c))
        );
      } finally {
        urlFetchInFlightRef.current.delete(clip.twitch_clip_id);
      }
    },
    [clips, resolveClipUrl]
  );

  useEffect(() => {
    if (clips.length === 0 || loading) return;
    loadClipIntoPlayer(currentIndex, getActiveRef());
  }, [clips.length, loading, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (clips.length <= 1 || loading) return;
    let nextIndex = (currentIndex + 1) % clips.length;
    if (isRandomMode && playOrder.length === clips.length) {
      if (orderPosition + 1 < playOrder.length) {
        nextIndex = playOrder[orderPosition + 1];
      } else {
        const nextOrder = createPlaybackOrder(clips.length, true, currentIndex);
        nextIndex = nextOrder[0];
      }
    }
    prefetchClipUrl(nextIndex);
  }, [clips, currentIndex, loading, prefetchClipUrl, isRandomMode, playOrder, orderPosition]);

  const playNext = useCallback(async () => {
    if (clips.length <= 1) {
      const ref = getActiveRef();
      if (ref.current) {
        ref.current.currentTime = 0;
        if (mediaShouldPlay) {
          ref.current.play().catch((err) => {
            if (
              previewEditor &&
              err instanceof DOMException &&
              err.name === "NotAllowedError"
            ) {
              editorClipPlayback?.setAutoplayBlocked(true);
            }
          });
        }
      }
      return;
    }

    let nextIdx = (currentIndex + 1) % clips.length;
    let tempOrder =
      playOrder.length === clips.length
        ? [...playOrder]
        : createPlaybackOrder(clips.length, isRandomMode);
    let tempOrderPosition = orderPosition;
    let attempts = 0;

    while (attempts < clips.length) {
      if (isRandomMode) {
        tempOrderPosition += 1;
        if (tempOrderPosition >= tempOrder.length) {
          tempOrder = createPlaybackOrder(clips.length, true, currentIndex);
          tempOrderPosition = 0;
        }
        nextIdx = tempOrder[tempOrderPosition];
      } else if (attempts > 0) {
        nextIdx = (nextIdx + 1) % clips.length;
      }

      const inactiveRef = getInactiveRef();
      const loaded = await loadClipIntoPlayer(nextIdx, inactiveRef);

      if (loaded && inactiveRef.current) {
        await new Promise<void>((resolve) => {
          const handler = () => {
            inactiveRef.current?.removeEventListener("canplay", handler);
            resolve();
          };
          inactiveRef.current!.addEventListener("canplay", handler);
          setTimeout(resolve, 3000);
        });

        setActivePlayer((prev) => (prev === 0 ? 1 : 0));
        setCurrentIndex(nextIdx);
        if (isRandomMode) {
          setPlayOrder(tempOrder);
          setOrderPosition(tempOrderPosition);
        } else {
          setOrderPosition(nextIdx);
        }

        if (mediaShouldPlay) {
          inactiveRef.current.play().catch((err) => {
            if (
              previewEditor &&
              err instanceof DOMException &&
              err.name === "NotAllowedError"
            ) {
              editorClipPlayback?.setAutoplayBlocked(true);
            }
          });
        }
        return;
      }

      attempts++;
    }
  }, [
    clips,
    currentIndex,
    mediaShouldPlay,
    isRandomMode,
    playOrder,
    orderPosition,
    getActiveRef,
    getInactiveRef,
    loadClipIntoPlayer,
    previewEditor,
    editorClipPlayback,
  ]);

  useEffect(() => {
    const a = videoRefA.current;
    const b = videoRefB.current;
    if (a) {
      a.muted = muted;
      a.volume = volume;
    }
    if (b) {
      b.muted = muted;
      b.volume = volume;
    }
  }, [muted, volume]);

  return {
    clips,
    currentClip: clips[currentIndex],
    loading,
    activePlayer,
    videoRefA,
    videoRefB,
    videoOpacityTransitionStyle,
    mediaShouldPlay,
    muted,
    previewEditor,
    playNext,
  };
}
