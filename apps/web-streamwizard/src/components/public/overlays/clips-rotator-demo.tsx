"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, MotionConfig, motion, useInView } from "motion/react";
import { Eye, Volume2, VolumeX, X } from "lucide-react";
import { BsTwitch } from "react-icons/bs";
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Slider,
  Switch,
  cn,
} from "@repo/ui";
import {
  CLIP_SOURCE_MODES,
  CLIP_SORT_OPTIONS,
  CLIP_TRANSITION_MODES,
  TIME_WINDOW_PRESETS,
  type ClipSortOption,
  type ClipSourceMode,
  type ClipTransitionMode,
  type TimeWindowPreset,
} from "@repo/ui/overlay";
import { InspectorReveal, InspectorSection } from "@/components/overlays/editor/inspector-section";
import { createPlaybackOrder, seededRng } from "@/lib/clip-playback-order";
import { formatDate } from "@/lib/format";
import type { RealClipCard } from "../home/demo-data";
import { useDemoTracking } from "../analytics/use-demo-tracking";

/*
 * The clips rotator with its settings wired to its output: the panel on the
 * left is the widget's source inspector, the frame on the right is what OBS
 * ends up showing. Uncheck a folder and those clips leave the rotation and
 * the up next strip. An earlier version drew the panel alone, which explained
 * the settings to people who did not yet know what the widget was.
 *
 * The clips are real, from the same get_showcase_clips RPC the landing page
 * marquee runs on, and so is the video: the page resolves each clip's signed
 * MP4 on the server (see lib/showcase-clip-videos) and hands it down. Two
 * video elements alternate so the next clip is already loaded behind the one
 * on screen, which is how the widget itself avoids a black frame; the clip's
 * thumbnail sits underneath for the ones Twitch would not sign.
 *
 * Clips play to their end here exactly as they do in OBS, so the rotation is
 * driven by `ended` rather than by a timer.
 *
 * Ordering comes from lib/clip-playback-order, the editor's own play order,
 * and the sort columns match CLIP_SORT_COLUMNS in the overlay query builder.
 * Modes, sorts and transitions come from the widget's config types, so the
 * page cannot offer an option the inspector does not have.
 */

const SOURCE_MODE_LABELS: Record<ClipSourceMode, string> = {
  all: "All Clips",
  folders: "Specific Folders",
  game: "By Game / Category",
  custom: "Custom Filters",
};

/** The editor's own wording, from the sort select in the clips inspector. */
const SORT_LABELS: Record<ClipSortOption, string> = {
  newest: "Newest First",
  oldest: "Oldest First",
  most_viewed: "Most Viewed",
  least_viewed: "Least Viewed",
  random: "Random",
};

/** The editor's own wording, from the clip transition select. */
const TRANSITION_LABELS: Record<ClipTransitionMode, string> = {
  cut: "Hard cut",
  crossfade: "Crossfade",
};

/** The editor's own wording, from the time window select. */
const TIME_WINDOW_LABELS: Record<TimeWindowPreset | "custom", string> = {
  last7d: "Last 7 Days",
  last30d: "Last 30 Days",
  last90d: "Last 90 Days",
  last365d: "Last Year",
  all: "All Time",
  custom: "Custom Range",
};

/** Days behind a relative preset; "all" and "custom" are handled on their own. */
const TIME_WINDOW_DAYS: Record<TimeWindowPreset, number | null> = {
  last7d: 7,
  last30d: 30,
  last90d: 90,
  last365d: 365,
  all: null,
};

const DAY_MS = 86400000;

/** `space-y-3` in pixels: what a revealed block has to grow its own margin to. */
const FIELD_GAP = 12;

/** Matches the widget's default `clipTransitionMs`, and the slider's bounds. */
const DEFAULT_CROSSFADE_MS = 600;
const MIN_CROSSFADE_MS = 200;
const MAX_CROSSFADE_MS = 3000;

/**
 * Only a stall guard. Clips advance when they end, the way the widget does;
 * this is the escape hatch for media that never fires `ended` at all. Twitch
 * caps clips at a minute, so nothing legitimate should ever reach it.
 */
const STALL_GUARD_MS = 90000;

/** The renderer's own copy when the filters match nothing. */
const EMPTY_STATE = "No clips match this widget.";

/** Where the slider lands when a visitor unmutes: audible, not startling. */
const DEFAULT_VOLUME = 0.6;

/** Twitch login of the person who built this, for the shoutout line's easter egg. */
const OWNER_LOGIN = "jochemwhite";

/** Folder names are illustrative (a visitor has no account), the clips inside them are real. */
const DEMO_FOLDERS = ["Best of chat", "Clip of the week", "Rage quits"] as const;

type DemoFolder = (typeof DEMO_FOLDERS)[number];

type FolderState = Record<DemoFolder, boolean>;

const INITIAL_FOLDERS: FolderState = {
  "Best of chat": true,
  "Clip of the week": true,
  "Rage quits": false,
};

/** A showcase clip with the demo's own folder bucket attached. */
interface RotatorClip extends RealClipCard {
  folder: DemoFolder;
  date: string;
  createdSort: number;
}

export function ClipsRotatorDemo({ clips, videos }: { clips: RealClipCard[]; videos: Record<string, string> }) {
  const track = useDemoTracking("clips_rotator");
  const frameRef = useRef<HTMLDivElement>(null);
  const inView = useInView(frameRef, { margin: "-48px" });

  const [mode, setMode] = useState<ClipSourceMode>("folders");
  const [folders, setFolders] = useState<FolderState>(INITIAL_FOLDERS);
  const [sort, setSort] = useState<ClipSortOption>("random");
  const [transition, setTransition] = useState<ClipTransitionMode>("crossfade");
  /* Starts muted because that is the only way a browser lets it autoplay,
     which is the same reason the widget's own clipMuted defaults the way it
     does. Unmuting is a click, and it sticks for the clips after this one. */
  const [muted, setMuted] = useState(true);
  /* Only reachable once unmuted, and it survives the clip changing under it,
     the same way the widget's own clipVolume does. */
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  /* Clips get a folder by position, so the buckets stay stable across renders
     and every folder ends up with something in it. */
  const pool = useMemo<RotatorClip[]>(
    () =>
      clips.map((clip, i) => ({
        ...clip,
        folder: DEMO_FOLDERS[i % DEMO_FOLDERS.length] as DemoFolder,
        date: clip.createdAt ? formatDate(clip.createdAt) : "",
        createdSort: clip.createdAt ? Date.parse(clip.createdAt) : 0,
      })),
    [clips],
  );

  /* The category and creator the game and custom modes filter on. Both are
     picked from the folders that start checked, so arriving on either mode
     always leaves clips on screen: a mode that opens on "no clips match"
     would read as a broken demo rather than as a filter doing its job.
     Unchecking a folder can still empty it, which is the point. */
  const { featuredCategory, featuredCreator } = useMemo(() => {
    const inDefaultFolders = pool.filter((clip) => INITIAL_FOLDERS[clip.folder]);
    const mostCommon = <T,>(rows: T[], pick: (row: T) => string | null): string | null => {
      const counts = new Map<string, number>();
      for (const row of rows) {
        const key = pick(row);
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      let best: string | null = null;
      let bestCount = 0;
      for (const [name, count] of counts) {
        if (count > bestCount) {
          best = name;
          bestCount = count;
        }
      }
      return best;
    };

    const category = mostCommon(inDefaultFolders, (clip) => clip.category ?? null);
    const creator = mostCommon(
      inDefaultFolders.filter((clip) => clip.category === category),
      (clip) => clip.creator,
    );
    return { featuredCategory: category, featuredCreator: creator };
  }, [pool]);

  /* The chip fields, seeded so the game and custom modes open on something
     that matches. Typing another one is allowed, and typing one nothing
     matches lands on the widget's own empty state, which is the honest
     answer rather than a special case. */
  const [gameFilters, setGameFilters] = useState<string[]>(() =>
    featuredCategory ? [featuredCategory] : [],
  );
  const [creatorFilters, setCreatorFilters] = useState<string[]>(() =>
    featuredCreator ? [featuredCreator] : [],
  );
  const [timeWindow, setTimeWindow] = useState<TimeWindowPreset | "custom">("all");
  /* The cutoff behind a relative preset, resolved when the preset is picked
     rather than while rendering: the clock is not something a render is
     allowed to read, and the answer only has to be right per pick. */
  const [relativeFrom, setRelativeFrom] = useState<number | null>(null);
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [minViews, setMinViews] = useState(0);
  const [transitionMs, setTransitionMs] = useState(DEFAULT_CROSSFADE_MS);

  /* Filter, then order. Sequential sorts use the same columns and directions
     as CLIP_SORT_COLUMNS in the overlay query builder; random is left in pool
     order here and shuffled by the play order below, exactly as the editor
     does it. */
  const queue = useMemo(() => {
    /* The time window and the view floor apply in every mode, the way the
       query builder applies them. */
    const from =
      timeWindow === "custom" ? (customRange.start ? Date.parse(customRange.start) : null) : relativeFrom;
    // The end date is inclusive in the editor's picker, so the day it names counts.
    const until = timeWindow === "custom" && customRange.end ? Date.parse(customRange.end) + DAY_MS : null;
    const listed = (values: string[], value: string | null | undefined) =>
      values.length === 0 || (value != null && values.some((v) => v.toLowerCase() === value.toLowerCase()));

    const matches = pool.filter((clip) => {
      if (clip.views < minViews) return false;
      if (from !== null && clip.createdSort < from) return false;
      if (until !== null && clip.createdSort >= until) return false;
      if (mode === "all") return true;
      if (mode === "folders") return folders[clip.folder];
      if (mode === "game") return listed(gameFilters, clip.category);
      return folders[clip.folder] && listed(gameFilters, clip.category) && listed(creatorFilters, clip.creator);
    });

    const ordered = [...matches];
    switch (sort) {
      case "newest":
        return ordered.sort((a, b) => b.createdSort - a.createdSort);
      case "oldest":
        return ordered.sort((a, b) => a.createdSort - b.createdSort);
      case "most_viewed":
        return ordered.sort((a, b) => b.views - a.views);
      case "least_viewed":
        return ordered.sort((a, b) => a.views - b.views);
      case "random":
        return ordered;
    }
  }, [pool, mode, folders, sort, gameFilters, creatorFilters, timeWindow, relativeFrom, customRange, minViews]);

  /* The editor's play order: sequential sorts walk the list, random walks a
     shuffle and reshuffles at the end without repeating the clip that just
     played. The first order is seeded so the server and the client agree on
     it; every reshuffle after hydration uses the real Math.random default. */
  const initialOrder = useMemo(
    () => createPlaybackOrder(queue.length, sort === "random", undefined, seededRng(queue.length * 2654435761)),
    [queue.length, sort],
  );

  const [playOrder, setPlayOrder] = useState<number[]>(initialOrder);
  const [orderPosition, setOrderPosition] = useState(0);
  /* Which of the two video elements is on screen. The other one is loading
     the clip after it, so a transition never waits on the network. */
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);

  /* Any change to the filters restarts the rotation, so the frame always
     shows the first clip of what you just picked instead of landing mid-queue
     on whatever position survived. Adjusted during render rather than in an
     effect: an effect would paint the stale clip for one frame first. */
  const queueKey = `${sort}|${queue.map((clip) => clip.id).join("|")}`;
  const [lastQueueKey, setLastQueueKey] = useState(queueKey);
  if (lastQueueKey !== queueKey) {
    setLastQueueKey(queueKey);
    setPlayOrder(initialOrder);
    setOrderPosition(0);
    setActiveSlot(0);
  }

  /* React still renders once with the new queue and the previous order before
     the reset above lands. An order of the wrong length indexes that queue
     wrongly: a shorter one wraps two positions onto the same clip, which then
     renders twice under one key. Fall back to the fresh order for that render
     rather than trusting a mismatched one. */
  const order = playOrder.length === queue.length ? playOrder : initialOrder;

  const advance = useCallback(() => {
    if (order.length < 2) return;
    setActiveSlot((slot) => (slot === 0 ? 1 : 0));
    setOrderPosition((position) => {
      const next = position + 1;
      if (next < order.length) return next;
      if (sort === "random") {
        setPlayOrder(createPlaybackOrder(order.length, true, order[position]));
      }
      return 0;
    });
  }, [order, sort]);

  const currentIndex = order[orderPosition] ?? 0;
  const clip = queue[currentIndex];
  const channel = clip ? clipChannel(clip) : null;
  /* The founder's own clips are in the pool like anyone else's, and crediting
     yourself with a straight face reads oddly. */
  const isOwnClip = channel?.login === OWNER_LOGIN;
  const fadeMs = transition === "crossfade" ? transitionMs : 0;

  /* Slot sources. The active slot keeps the URL it was already preloading,
     and the one that just went dark picks up the clip after next, so each
     element only ever loads a clip while it is invisible. */
  const slotUrls = useMemo<[string | null, string | null]>(() => {
    if (!inView || order.length === 0) return [null, null];
    const urlAt = (position: number) => {
      const entry = queue[order[position % order.length] ?? 0];
      return entry ? (videos[entry.id] ?? null) : null;
    };
    const current = urlAt(orderPosition);
    const upcoming = order.length > 1 ? urlAt(orderPosition + 1) : null;
    return activeSlot === 0 ? [current, upcoming] : [upcoming, current];
  }, [inView, queue, order, orderPosition, activeSlot, videos]);

  const videoRefs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)] as const;

  /* Sources are assigned here rather than through a `src` prop. Changing the
     attribute alone lets an element keep serving the media it already had, so
     a slot could come back around still holding the clip from two rotations
     ago; load() is what actually swaps the resource. Same reason the editor's
     own playlist hook sets `.src` then calls `.load()`. */
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    videoRefs.forEach((ref, slot) => {
      const el = ref.current;
      const url = slotUrls[slot];
      if (!el || !url || el.dataset.clipSrc === url) return;

      const assign = () => {
        el.dataset.clipSrc = url;
        el.src = url;
        el.load();
      };

      /* The slot that just went dark is still fading out, and it is still
         painting its own clip. Re-sourcing it now would replace that picture
         with the first frame of a clip further down the queue, mid-fade, so
         it waits out the crossfade first. */
      if (slot === activeSlot) assign();
      else timers.push(setTimeout(assign, fadeMs));
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotUrls, activeSlot, fadeMs]);

  /* Playback. Keyed on the visible slot's own source, never on both: the
     hidden slot picks up its next clip mid-rotation, and re-running this then
     would restart whatever is on screen. Watching the visible URL does matter
     though. Changing a filter rebuilds the queue while activeSlot and
     orderPosition are both already 0, so nothing else here would change, yet
     the effect above has just called load() on the visible element and load()
     leaves it paused. */
  const activeUrl = slotUrls[activeSlot];

  useEffect(() => {
    videoRefs.forEach((ref, slot) => {
      const el = ref.current;
      if (!el) return;
      if (slot === activeSlot && inView && slotUrls[slot]) {
        // Rewind only once there is media to rewind; right after load() the
        // element has no duration yet and assigning currentTime throws.
        if (el.readyState > 0) {
          try {
            el.currentTime = 0;
          } catch {}
        }
        // Muted autoplay is allowed everywhere; the catch is for the odd
        // browser that still says no, where the thumbnail carries the frame.
        el.play().catch(() => {});
      } else {
        el.pause();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlot, orderPosition, inView, activeUrl]);

  /* Only the clip on screen is ever audible. The other element is paused, but
     it is also holding a different clip, so it stays muted regardless. Set on
     the element rather than through the `muted` prop, which React does not
     reliably apply to media elements after the first render. Volume goes on
     both, so the clip waiting in the wings comes in at the same level. */
  useEffect(() => {
    videoRefs.forEach((ref, slot) => {
      const el = ref.current;
      if (!el) return;
      el.muted = muted || slot !== activeSlot;
      el.volume = volume;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, volume, activeSlot, orderPosition, activeUrl]);

  /* A clip ending is what advances the rotation, exactly as the widget does.
     This timer only catches media that never fires `ended`, so the rotation
     cannot park on one clip forever. */
  useEffect(() => {
    if (!inView || queue.length < 2) return;
    const id = setTimeout(advance, STALL_GUARD_MS);
    return () => clearTimeout(id);
  }, [inView, queue.length, advance, orderPosition]);
  /* The rotation in the order it will actually play, which is what the list
     beside the frame draws: sequential sorts walk the queue, random walks the
     shuffle, so the list reorders when the sort does. */
  const rotation = useMemo(
    () => order.map((index) => queue[index]).filter((entry): entry is RotatorClip => entry != null),
    [order, queue],
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)_minmax(0,288px)]">
        {/* Left: the widget's inspector, the same panel and the same controls
            the editor draws for a clips widget, wired to the frame beside it.
            Anything with no data behind it on a public page — the folder rows,
            the featured-only toggle — is either filled with demo names or left
            out rather than faked. */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-[0_16px_48px_-16px_rgba(158,122,255,0.25)] sm:p-5 lg:row-span-2 xl:row-span-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Inspector · Clips widget
          </p>

          <div className="mt-4 space-y-5">
            <InspectorSection title="Clip Source" defaultOpen>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Source Mode</Label>
                  <Select
                    value={mode}
                    onValueChange={(val) => {
                      track(`source_${val}`);
                      setMode(val as ClipSourceMode);
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm" aria-label="Source Mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIP_SOURCE_MODES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {SOURCE_MODE_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <InspectorReveal show={mode === "folders" || mode === "custom"} marginTop={FIELD_GAP}>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Folders</Label>
                    <div className="space-y-1.5">
                      {DEMO_FOLDERS.map((name) => (
                        <label
                          key={name}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent/50"
                        >
                          <Checkbox
                            checked={folders[name]}
                            onCheckedChange={() => {
                              track("folder_toggle");
                              setFolders((f) => ({ ...f, [name]: !f[name] }));
                            }}
                          />
                          <span className="truncate">{name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </InspectorReveal>

                <InspectorReveal show={mode === "game" || mode === "custom"} marginTop={FIELD_GAP}>
                  <ChipField
                    label="Game / Category"
                    placeholder="Add a category and press Enter"
                    values={gameFilters}
                    onAdd={(value) => {
                      track("game_filter");
                      setGameFilters((v) => [...v, value]);
                    }}
                    onRemove={(value) => {
                      track("game_filter");
                      setGameFilters((v) => v.filter((entry) => entry !== value));
                    }}
                  />
                </InspectorReveal>

                <InspectorReveal show={mode === "custom"} marginTop={FIELD_GAP}>
                  <ChipField
                    label="Clipped by (optional)"
                    placeholder="Add a clipper and press Enter"
                    values={creatorFilters}
                    onAdd={(value) => {
                      track("creator_filter");
                      setCreatorFilters((v) => [...v, value]);
                    }}
                    onRemove={(value) => {
                      track("creator_filter");
                      setCreatorFilters((v) => v.filter((entry) => entry !== value));
                    }}
                  />
                </InspectorReveal>
              </div>
            </InspectorSection>

            <Separator />

            <InspectorSection title="Playback">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Muted</Label>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      Off to hear clip audio in OBS (browsers often require mute for autoplay until the user
                      interacts).
                    </p>
                  </div>
                  <Switch
                    checked={muted}
                    onCheckedChange={(checked) => {
                      track(checked ? "mute" : "unmute");
                      if (!checked && volume === 0) setVolume(DEFAULT_VOLUME);
                      setMuted(checked);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Volume ({Math.round(volume * 100)}%)</Label>
                  <Slider
                    value={[volume]}
                    min={0}
                    max={1}
                    step={0.05}
                    aria-label="Volume"
                    onValueChange={([v]) => {
                      track("volume");
                      setVolume(Math.max(0, Math.min(1, v ?? 0)));
                    }}
                    className="py-1"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Clip transition</Label>
                  <Select
                    value={transition}
                    onValueChange={(val) => {
                      track(`transition_${val}`);
                      setTransition(val as ClipTransitionMode);
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm" aria-label="Clip transition">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIP_TRANSITION_MODES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TRANSITION_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Hard cut switches instantly; crossfade overlaps clips for a short blend.
                  </p>
                </div>

                <InspectorReveal show={transition === "crossfade"} marginTop={FIELD_GAP}>
                  <div className="space-y-2">
                    <Label className="text-xs">Crossfade ({transitionMs} ms)</Label>
                    <Slider
                      value={[transitionMs]}
                      min={MIN_CROSSFADE_MS}
                      max={MAX_CROSSFADE_MS}
                      step={50}
                      aria-label="Crossfade length"
                      onValueChange={([v]) => {
                        track("crossfade_ms");
                        setTransitionMs(
                          Math.round(
                            Math.max(MIN_CROSSFADE_MS, Math.min(MAX_CROSSFADE_MS, v ?? DEFAULT_CROSSFADE_MS)),
                          ),
                        );
                      }}
                      className="py-1"
                    />
                  </div>
                </InspectorReveal>
              </div>
            </InspectorSection>

            <Separator />

            <InspectorSection title="Time Window">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Period</Label>
                  <Select
                    value={timeWindow}
                    onValueChange={(val) => {
                      track("time_window");
                      const preset = val as TimeWindowPreset | "custom";
                      const days = preset === "custom" ? null : TIME_WINDOW_DAYS[preset];
                      setRelativeFrom(days ? Date.now() - days * DAY_MS : null);
                      setTimeWindow(preset);
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm" aria-label="Period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[...TIME_WINDOW_PRESETS, "custom" as const].map((preset) => (
                        <SelectItem key={preset} value={preset}>
                          {TIME_WINDOW_LABELS[preset]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <InspectorReveal show={timeWindow === "custom"} marginTop={FIELD_GAP}>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Start</Label>
                      <Input
                        type="date"
                        value={customRange.start}
                        onChange={(e) => {
                          track("custom_range");
                          setCustomRange((r) => ({ ...r, start: e.target.value }));
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">End</Label>
                      <Input
                        type="date"
                        value={customRange.end}
                        onChange={(e) => {
                          track("custom_range");
                          setCustomRange((r) => ({ ...r, end: e.target.value }));
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </InspectorReveal>
              </div>
            </InspectorSection>

            <Separator />

            <InspectorSection title="Sort & Limits">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Sort By</Label>
                  <Select
                    value={sort}
                    onValueChange={(val) => {
                      track(`sort_${val}`);
                      setSort(val as ClipSortOption);
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm" aria-label="Sort By">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIP_SORT_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {SORT_LABELS[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Min View Count</Label>
                  <Input
                    type="number"
                    value={minViews}
                    onChange={(e) => {
                      track("min_views");
                      setMinViews(Math.max(0, Number(e.target.value)));
                    }}
                    className="h-8 text-sm"
                    min={0}
                  />
                </div>
              </div>
            </InspectorSection>

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                track("reset");
                setMode("folders");
                setFolders(INITIAL_FOLDERS);
                setGameFilters(featuredCategory ? [featuredCategory] : []);
                setCreatorFilters(featuredCreator ? [featuredCreator] : []);
                setTimeWindow("all");
                setRelativeFrom(null);
                setCustomRange({ start: "", end: "" });
                setMinViews(0);
                setSort("random");
                setTransition("crossfade");
                setTransitionMs(DEFAULT_CROSSFADE_MS);
              }}
            >
              Reset to Defaults
            </Button>
          </div>
        </div>

        {/* Right: what OBS ends up showing. */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-purple-300">On stream</p>

          {/* These are real clips from real channels, so the channel gets its
              name above the frame and a link home. */}
          {clip && channel ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Clip from{" "}
              <a
                href={channel.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("broadcaster_shoutout")}
                className="inline-flex items-center gap-1 font-medium text-purple-300 underline underline-offset-2 transition-colors hover:text-purple-200"
              >
                <BsTwitch className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {clip.broadcaster}
              </a>
              . {isOwnClip ? <>That&apos;s me. Perks of building the site.</> : <>Go check them out.</>}
            </p>
          ) : null}

          {/* The sound control sits outside the frame's own element: that one
              is role="img", which makes everything inside it presentational,
              and a button in there would be unreachable. */}
          <div className="relative mt-2">
          <div
            ref={frameRef}
            role="img"
            aria-label={
              clip
                ? `The clips widget playing ${clip.title}, with its title, creator, category, date, views and duration drawn on top`
                : "The clips widget with no clips matching the filters"
            }
            className="@container relative aspect-video overflow-hidden rounded-xl border border-white/[0.08] bg-black shadow-[0_16px_48px_-16px_rgba(158,122,255,0.25)]"
          >
            {!clip ? (
              <div
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center bg-black/85 px-4 text-center text-xs text-muted-foreground @sm:text-sm"
              >
                {EMPTY_STATE}
              </div>
            ) : (
              /* The still under the video: what a clip Twitch would not sign
                 falls back to, and what fills the frame until the first one
                 has decoded. */
              <Image
                src={clip.thumbnailUrl}
                alt=""
                fill
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="object-cover"
              />
            )}

            {/* The two players. Whichever is not on screen is loading the
                next clip, so a transition never shows a spinner. The pair
                carries the crossfade on its own: fading the still and the
                metadata alongside them would leave the previous clip's frame
                and title sitting on top of the new one for the whole fade. */}
            {[0, 1].map((slot) => (
              <video
                key={slot}
                ref={videoRefs[slot]}
                muted={muted || slot !== activeSlot}
                playsInline
                preload="auto"
                aria-hidden="true"
                /* Only the visible slot drives the rotation. The hidden one is
                   loading the next clip, and a preload that fails there must
                   not skip the clip currently on screen. */
                onEnded={slot === activeSlot ? advance : undefined}
                onError={slot === activeSlot ? advance : undefined}
                style={{
                  opacity: slot === activeSlot && slotUrls[slot] ? 1 : 0,
                  transitionProperty: "opacity",
                  transitionDuration: `${fadeMs}ms`,
                  transitionTimingFunction: "ease-in-out",
                }}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ))}

            {clip ? (
              /* Keyed on the clip so a new one remounts and fades in with the
                 video it belongs to. No exit animation on purpose: an
                 outgoing copy would sit on top of the incoming title for the
                 length of the crossfade. */
              <motion.div
                key={clip.id}
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: fadeMs / 1000, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/75 to-transparent" />

                  {/* The six display fields, sitting where the widget's
                      defaults put them: title on the lower left, the meta row
                      under it, views and duration under that. Type is bumped
                      for a frame this small; the positions are the real ones. */}
                  <div className="absolute inset-x-0 bottom-0 p-2 @sm:p-3 @lg:p-4">
                    <p className="max-w-[80%] truncate text-[11px] font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] @sm:text-sm @lg:text-base">
                      {clip.title}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8px] text-white/85 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] @sm:mt-1 @sm:text-[10px] @lg:text-xs">
                      <span>clipped by {clip.creator}</span>
                      {clip.category ? (
                        <>
                          <span className="text-white/40">·</span>
                          <span>{clip.category}</span>
                        </>
                      ) : null}
                      {clip.date ? (
                        <>
                          <span className="text-white/40">·</span>
                          <span>{clip.date}</span>
                        </>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[8px] tabular-nums text-white/85 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] @sm:mt-1 @sm:text-[10px] @lg:text-xs">
                      <span className="flex items-center gap-1">
                        <Eye className="h-2.5 w-2.5 @sm:h-3 @sm:w-3" aria-hidden="true" />
                        {clip.views.toLocaleString("en-US")}
                      </span>
                      <span className="text-white/40">·</span>
                      <span>{clip.duration}</span>
                    </div>
                  </div>
              </motion.div>
            ) : null}

            {/* One dot per clip in the rotation: the queue length, made visible. */}
            {queue.length > 0 ? (
              <div aria-hidden="true" className="absolute right-2 top-2 flex gap-1 @sm:right-3 @sm:top-3">
                {queue.map((c, i) => (
                  <span
                    key={c.id}
                    className={cn(
                      "h-1 w-2 rounded-full transition-colors @sm:w-3",
                      i === currentIndex ? "bg-white/90" : "bg-white/30",
                    )}
                  />
                ))}
              </div>
            ) : null}
          </div>

            {clip ? (
              <div className="absolute left-2 top-2 flex items-center gap-1.5 sm:left-3 sm:top-3">
                <button
                  type="button"
                  aria-pressed={!muted}
                  aria-label={muted ? "Unmute the clip" : "Mute the clip"}
                  onClick={() => {
                    track(muted ? "unmute" : "mute");
                    setMuted((m) => {
                      // Unmuting into a slider someone dragged to zero would
                      // look broken, so that case comes back at the default.
                      if (m && volume === 0) setVolume(DEFAULT_VOLUME);
                      return !m;
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] bg-black/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-white/90 backdrop-blur-sm transition-colors hover:border-purple-400/40 hover:bg-black/75 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {muted ? (
                    <VolumeX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5 shrink-0 text-purple-300" aria-hidden="true" />
                  )}
                  {muted ? "Unmute" : "Mute"}
                </button>

                {/* Only worth the pixels once there is sound to set a level for. */}
                {!muted ? (
                  <motion.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="flex items-center gap-2 rounded-full border border-white/[0.14] bg-black/60 px-3 py-1.5 backdrop-blur-sm"
                  >
                    <Slider
                      value={[Math.round(volume * 100)]}
                      onValueChange={([next]) => {
                        track("volume");
                        setVolume((next ?? 0) / 100);
                      }}
                      min={0}
                      max={100}
                      step={1}
                      aria-label="Clip volume"
                      className="w-16 sm:w-20 [&_[data-slot=slider-range]]:bg-purple-400 [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-purple-300 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-track]]:bg-white/20"
                    />
                    <span className="w-6 shrink-0 text-right font-mono text-[10px] tabular-nums text-white/70">
                      {Math.round(volume * 100)}
                    </span>
                  </motion.div>
                ) : null}
              </div>
            ) : null}
          </div>

        </div>

        {/* Third: the rotation itself, in play order, carrying the fields the
            filters on the left act on. A clip a filter just let in animates in
            where it will play; one a filter just excluded leaves. Reordering is
            layout animation rather than a re-render, so changing the sort reads
            as the queue rearranging itself. */}
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-purple-300">In rotation</p>
            <p className="font-mono text-[10px] uppercase tracking-widest tabular-nums text-muted-foreground">
              {queue.length} {queue.length === 1 ? "clip" : "clips"}
            </p>
          </div>

          {rotation.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-white/[0.1] px-3 py-8 text-center text-xs text-muted-foreground">
              {EMPTY_STATE}
            </p>
          ) : (
            <ul
              aria-label="Clips in the rotation"
              className="mt-2 space-y-1.5 lg:max-h-[28rem] lg:overflow-y-auto lg:pr-1"
            >
              <AnimatePresence initial={false} mode="popLayout">
                {rotation.map((entry, index) => {
                  const onAir = index === orderPosition;
                  return (
                    <motion.li
                      key={entry.id}
                      layout
                      initial={{ opacity: 0, x: 12, scale: 0.98 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -12, scale: 0.96 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className={cn(
                        "rounded-lg border px-2.5 py-2 transition-colors duration-300",
                        onAir
                          ? "border-purple-400/40 bg-purple-500/10"
                          : "border-white/[0.07] bg-white/[0.03]",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 w-4 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <p
                              className={cn(
                                "min-w-0 flex-1 truncate text-xs font-medium",
                                onAir ? "text-purple-200" : "text-foreground/90",
                              )}
                            >
                              {entry.title}
                            </p>
                            {onAir ? (
                              <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-purple-300">
                                On air
                              </span>
                            ) : null}
                          </div>

                          {/* The fields the inspector filters on, in the order
                              its sections ask for them. */}
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {entry.folder}
                            </span>
                            {entry.category ? (
                              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {entry.category}
                              </span>
                            ) : null}
                            <span className="truncate text-[10px] text-muted-foreground">
                              by {entry.creator}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-1.5 text-[10px] tabular-nums text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Eye className="h-3 w-3" aria-hidden="true" />
                              {entry.views.toLocaleString("en-US")}
                            </span>
                            <span className="text-white/25">·</span>
                            <span>{entry.duration}</span>
                            {entry.date ? (
                              <>
                                <span className="text-white/25">·</span>
                                <span>{entry.date}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>
    </MotionConfig>
  );
}

/**
 * The channel behind a clip. The login comes out of the clip's own Twitch URL
 * where there is one, because `broadcaster` is a display name and those do not
 * always match the login they live at.
 */
function clipChannel(clip: RotatorClip): { login: string; url: string } {
  let login = clip.broadcaster.toLowerCase();
  if (clip.url) {
    try {
      const segment = new URL(clip.url).pathname.split("/").filter(Boolean)[0];
      if (segment) login = segment.toLowerCase();
    } catch {}
  }
  return { login, url: `https://www.twitch.tv/${login}` };
}

/**
 * The inspector's tag field: chips with a remove button and an input that
 * takes one on Enter, the same shape the editor uses for game and creator
 * filters.
 */
function ChipField({
  label,
  placeholder,
  values,
  onAdd,
  onRemove,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="space-y-1.5">
        {values.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {values.map((value) => (
              <span key={value} className="inline-flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-xs">
                {value}
                <button
                  type="button"
                  aria-label={`Remove ${value}`}
                  onClick={() => onRemove(value)}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <Input
          placeholder={placeholder}
          aria-label={label}
          className="h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const input = e.target as HTMLInputElement;
            const value = input.value.trim();
            if (!value || values.some((entry) => entry.toLowerCase() === value.toLowerCase())) return;
            onAdd(value);
            input.value = "";
          }}
        />
      </div>
    </div>
  );
}
