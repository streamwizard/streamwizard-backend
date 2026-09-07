"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { useDemoTracking } from "../analytics/use-demo-tracking";
import {
  Badge,
  Button,
  Checkbox,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from "@repo/ui";
import {
  Filter,
  GripVertical,
  HandMetal,
  MessageSquare,
  Pause,
  Play,
  Scissors,
  Swords,
  Tv,
  UserPlus,
  Volume2,
  VolumeX,
  Zap,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import { formatOffset } from "@/lib/format";
import { DEMO_VOD_DURATION_SECONDS, demoVodEvents, demoVodMeta, demoVodSegments, type DemoVodEvent } from "./demo-data";

/*
 * /dashboard/vods/[id] on the landing page: the timeline, the stream events
 * panel, and the clip selection you drag out of a four-hour VOD.
 *
 * Shapes, labels and limits are the product's: markers use the dashboard's
 * event colors (EVENT_TYPE_CONFIG in lib/utils/stream-events.ts), the selection
 * is the same purple overlay with grip handles (components/vods/timeline/
 * clip-selection.tsx), the readout is the same "Clip: 42s (5s - 60s)" line
 * (timeline-display.tsx), and Save Clip lands the same toast the store fires
 * (stores/video-dialog-store.ts).
 *
 * What differs: there is no Twitch player behind it. The pane above the
 * timeline is a stand-in, not a video, because a VOD embed on a marketing page
 * would rot the day that VOD expires. Playback is a clock: pressing play sweeps
 * the playhead through four hours in about twenty seconds, and clip mode drops
 * to real time and loops the selection, which is what the real player does.
 */

const MIN_CLIP_SECONDS = 5;
const MAX_CLIP_SECONDS = 60;
/* Default selection around the playhead, as video-dialog-store.ts picks it. */
const CLIP_PAD_SECONDS = 15;
/* A four-hour VOD scrubs past in ~20s at this rate. */
const SWEEP_RATE = 750;
const MAX_ZOOM = 20;

/* The icon each event type wears in the dashboard's filter popover, keyed by
 * the label EVENT_TYPE_CONFIG gives it. */
const EVENT_ICONS: Record<string, LucideIcon> = {
  Follow: UserPlus,
  Subscription: MessageSquare,
  Cheer: Zap,
  Raid: Swords,
  "Ad Break": Tv,
  "Points Redemption": HandMetal,
  Clip: Scissors,
};

const SEGMENT_STYLES = {
  muted: {
    label: "Muted",
    className: "bg-red-500/40 border-x border-red-600/60",
    stripe: "rgba(248,113,113,0.5)",
    swatch: "bg-red-500/40 border-red-600/60",
  },
  ad_break: {
    label: "Ad Break",
    className: "bg-amber-500/40 border-x border-amber-600/60",
    stripe: "rgba(251,191,36,0.5)",
    swatch: "bg-amber-500/40 border-amber-600/60",
  },
} as const;

interface ClipSelection {
  startTime: number;
  endTime: number;
}

interface View {
  start: number;
  end: number;
}

const FULL_VIEW: View = { start: 0, end: DEMO_VOD_DURATION_SECONDS };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Ruler labels, spaced like the dashboard's (~one per 55px of track). */
function rulerLabels(view: View, count = 6): number[] {
  const span = view.end - view.start;
  return Array.from({ length: count }, (_, index) => view.start + (span * index) / (count - 1));
}

export function VodTimelineDemo() {
  const trackRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-64px" });
  const reducedMotion = useReducedMotion();

  const [currentTime, setCurrentTime] = useState(7800);
  const [isPlaying, setIsPlaying] = useState(false);
  /* Autoplay-until-touched: the sweep starts itself the first time the demo
   * scrolls into view, and the first real interaction hands playback to the
   * visitor for good. Neither ref change fires analytics; useDemoTracking
   * stays a touched-it signal. */
  const touchedRef = useRef(false);
  const autoStartedRef = useRef(false);
  const [isMuted, setIsMuted] = useState(true);
  const track = useDemoTracking("vods");
  const [view, setView] = useState<View>(FULL_VIEW);
  const [clip, setClip] = useState<ClipSelection | null>(null);
  const [clipTitle, setClipTitle] = useState("");
  const [dragging, setDragging] = useState<"start" | "end" | "middle" | null>(null);
  const [createdClips, setCreatedClips] = useState<DemoVodEvent[]>([]);
  /* The nudge on Create Clip retires once a visitor has used it. */
  const [hasClipped, setHasClipped] = useState(false);

  const allEvents = useMemo(
    () => [...demoVodEvents, ...createdClips].sort((a, b) => a.offsetSeconds - b.offsetSeconds),
    [createdClips],
  );

  /* Counts per type feed both the filter popover and the legend, the way the
   * dashboard builds them from the event list. */
  const typeCounts = useMemo(() => {
    const counts = new Map<string, { count: number; color: string }>();
    for (const event of allEvents) {
      const previous = counts.get(event.label);
      counts.set(event.label, { count: (previous?.count ?? 0) + 1, color: event.color });
    }
    return new Map([...counts.entries()].sort((a, b) => b[1].count - a[1].count));
  }, [allEvents]);

  const [hiddenTypes, setHiddenTypes] = useState<string[]>([]);
  const events = useMemo(
    () => allEvents.filter((event) => !hiddenTypes.includes(event.label)),
    [allEvents, hiddenTypes],
  );

  const totalTypes = typeCounts.size;
  const selectedTypes = [...typeCounts.keys()].filter((type) => !hiddenTypes.includes(type));

  const zoom = DEMO_VOD_DURATION_SECONDS / (view.end - view.start);
  const timeToPercent = useCallback(
    (seconds: number) => ((seconds - view.start) / (view.end - view.start)) * 100,
    [view],
  );

  /* Pan and pinch on the track, the dashboard's gestures (video-timeline.tsx):
   * drag the track to pan once zoomed in (mouse or one finger), two fingers to
   * zoom around the point between them. Refs rather than state so the document
   * listeners do not re-bind per frame; `panning` drives the cursor. */
  const gestureRef = useRef<{
    kind: "pan" | "pinch";
    startX: number;
    startView: { start: number; end: number };
    /** Where the gesture has moved the view so far; a pinch hands this to the pan it turns into. */
    latestView: { start: number; end: number };
    pinchDistance: number;
    pinchSpan: number;
    anchorTime: number;
    anchorFraction: number;
    moved: boolean;
  } | null>(null);
  const [panning, setPanning] = useState(false);
  // A drag that moved the view must not also seek on the click that follows it.
  const suppressClickRef = useRef(false);

  /* Start the sweep once the demo is on screen, unless the visitor got there
   * first or asked for reduced motion. The delay keeps a fast scroll-past from
   * flashing the playhead (cleanup cancels it). */
  useEffect(() => {
    if (!inView || reducedMotion || touchedRef.current || autoStartedRef.current) return;
    const timer = setTimeout(() => {
      if (touchedRef.current) return;
      autoStartedRef.current = true;
      setIsPlaying(true);
    }, 600);
    return () => clearTimeout(timer);
  }, [inView, reducedMotion]);

  /* Playback. Outside clip mode this is a fast sweep of the whole VOD; inside
   * it, real time on a loop, the way the player behaves during clip creation.
   * Off screen the clock stops where it is and resumes on re-entry. */
  useEffect(() => {
    if (!isPlaying || !inView) return;
    let frame = 0;
    let last: number | null = null;

    const step = (timestamp: number) => {
      const delta = last == null ? 0 : (timestamp - last) / 1000;
      last = timestamp;

      setCurrentTime((previous) => {
        if (clip) {
          const next = previous + delta;
          return next >= clip.endTime ? clip.startTime : Math.max(previous, clip.startTime) + delta;
        }
        const next = previous + delta * SWEEP_RATE;
        return next >= DEMO_VOD_DURATION_SECONDS ? 0 : next;
      });

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, clip, inView]);

  const changeZoom = (factor: number) => {
    const center = clip ? (clip.startTime + clip.endTime) / 2 : currentTime;
    const span = clamp(
      (view.end - view.start) / factor,
      DEMO_VOD_DURATION_SECONDS / MAX_ZOOM,
      DEMO_VOD_DURATION_SECONDS,
    );
    const start = clamp(center - span / 2, 0, DEMO_VOD_DURATION_SECONDS - span);
    setView({ start, end: start + span });
  };

  /* Bound natively rather than through onWheel: React registers wheel handlers
   * passively, so preventDefault() there is ignored and the page scrolls away
   * under the cursor while you zoom. Same listener options and same Shift gate
   * the dashboard's track uses. */
  useEffect(() => {
    const element = trackRef.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.shiftKey) return;
      event.preventDefault();
      changeZoom(event.deltaY < 0 ? 1.2 : 1 / 1.2);
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, currentTime, clip]);

  const timeFromEvent = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return view.start + ratio * (view.end - view.start);
  };

  const panTo = (clientX: number) => {
    const gesture = gestureRef.current;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!gesture || gesture.kind !== "pan" || !rect) return;
    const deltaX = clientX - gesture.startX;
    if (Math.abs(deltaX) > 3) gesture.moved = true;
    const span = gesture.startView.end - gesture.startView.start;
    const start = clamp(gesture.startView.start - (deltaX / rect.width) * span, 0, DEMO_VOD_DURATION_SECONDS - span);
    gesture.latestView = { start, end: start + span };
    setView(gesture.latestView);
  };

  const pinchTo = (first: Touch, second: Touch) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.kind !== "pinch" || gesture.pinchDistance <= 0) return;
    const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
    const span = clamp(
      (gesture.pinchSpan * gesture.pinchDistance) / distance,
      DEMO_VOD_DURATION_SECONDS / MAX_ZOOM,
      DEMO_VOD_DURATION_SECONDS,
    );
    const start = clamp(gesture.anchorTime - gesture.anchorFraction * span, 0, DEMO_VOD_DURATION_SECONDS - span);
    gesture.latestView = { start, end: start + span };
    setView(gesture.latestView);
  };

  const endGesture = () => {
    if (gestureRef.current?.moved) {
      suppressClickRef.current = true;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    gestureRef.current = null;
    setPanning(false);
  };

  useEffect(() => {
    if (!panning) return;

    const onMouseMove = (event: MouseEvent) => panTo(event.clientX);
    const onTouchMove = (event: TouchEvent) => {
      const gesture = gestureRef.current;
      if (!gesture) return;
      event.preventDefault();
      if (gesture.kind === "pinch") {
        if (event.touches.length >= 2) pinchTo(event.touches[0], event.touches[1]);
        return;
      }
      if (event.touches.length > 0) panTo(event.touches[0].clientX);
    };
    const onTouchEnd = (event: TouchEvent) => {
      const gesture = gestureRef.current;
      // Pinch down to one finger while zoomed in: carry on as a pan, so the
      // gesture does not stop dead when the second finger lifts.
      if (gesture?.kind === "pinch" && event.touches.length === 1) {
        const current = gesture.latestView;
        if (DEMO_VOD_DURATION_SECONDS / (current.end - current.start) > 1.01) {
          gestureRef.current = { ...gesture, kind: "pan", startX: event.touches[0].clientX, startView: current };
          return;
        }
      }
      if (event.touches.length > 0) return;
      endGesture();
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", endGesture);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", endGesture);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [panning]);

  const isClipHandle = (target: EventTarget | null) =>
    target instanceof Element && target.closest("[data-clip-handle]") !== null;

  const onTrackMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || zoom <= 1.01 || isClipHandle(event.target)) return;
    gestureRef.current = {
      kind: "pan",
      startX: event.clientX,
      startView: view,
      latestView: view,
      pinchDistance: 0,
      pinchSpan: 0,
      anchorTime: 0,
      anchorFraction: 0,
      moved: false,
    };
    setPanning(true);
  };

  const onTrackTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 0 || isClipHandle(event.target)) return;
    const rect = trackRef.current?.getBoundingClientRect();

    // Two fingers: pinch, at any zoom level.
    if (event.touches.length >= 2 && rect) {
      track("pinched");
      const first = event.touches[0];
      const second = event.touches[1];
      const midX = (first.clientX + second.clientX) / 2;
      const fraction = clamp((midX - rect.left) / rect.width, 0, 1);
      const span = view.end - view.start;
      gestureRef.current = {
        kind: "pinch",
        startX: midX,
        startView: view,
        latestView: view,
        pinchDistance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
        pinchSpan: span,
        anchorTime: view.start + fraction * span,
        anchorFraction: fraction,
        moved: true,
      };
      setPanning(true);
      return;
    }

    // One finger: pan, only once zoomed in. At 1x the tap seeks instead.
    if (zoom <= 1.01) return;
    track("panned");
    gestureRef.current = {
      kind: "pan",
      startX: event.touches[0].clientX,
      startView: view,
      latestView: view,
      pinchDistance: 0,
      pinchSpan: 0,
      anchorTime: 0,
      anchorFraction: 0,
      moved: false,
    };
    setPanning(true);
  };

  const seekTo = (seconds: number) => {
    track("seeked");
    setCurrentTime(clamp(seconds, 0, DEMO_VOD_DURATION_SECONDS));
  };

  const zoomTo = (selection: ClipSelection) => {
    const span = Math.max((selection.endTime - selection.startTime) * 6, 120);
    const center = (selection.startTime + selection.endTime) / 2;
    setView({
      start: Math.max(0, center - span / 2),
      end: Math.min(DEMO_VOD_DURATION_SECONDS, center + span / 2),
    });
  };

  const startClipAt = (seconds: number) => {
    track("clip_started");
    const selection: ClipSelection = {
      startTime: Math.max(0, seconds - CLIP_PAD_SECONDS),
      endTime: Math.min(DEMO_VOD_DURATION_SECONDS, seconds + CLIP_PAD_SECONDS),
    };
    setClip(selection);
    setClipTitle("");
    setHasClipped(true);
    seekTo(selection.startTime);
    zoomTo(selection);
  };

  const cancelClip = () => {
    setClip(null);
    setClipTitle("");
    setView(FULL_VIEW);
  };

  const saveClip = () => {
    if (!clip || !clipTitle.trim()) return;
    track("clip_saved");
    setCreatedClips((previous) => [
      ...previous,
      {
        id: `new-clip-${previous.length}`,
        label: "Clip",
        color: "bg-teal-500",
        offsetSeconds: Math.round(clip.startTime),
        detail: clipTitle.trim(),
      },
    ]);
    toast.success("Clip created successfully!", {
      description: `${clipTitle.trim()} · ${Math.round(clip.endTime - clip.startTime)}s. In the demo it lives until you reload. In your account it stays.`,
    });
    cancelClip();
  };

  /* Handle drags. Pointer events keep mouse and touch on one path; the 5s/60s
   * clamp is the product's, enforced the same way while dragging. */
  useEffect(() => {
    if (!dragging || !clip) return;

    const onMove = (event: PointerEvent) => {
      const time = timeFromEvent(event.clientX);
      setClip((previous) => {
        if (!previous) return previous;
        if (dragging === "start") {
          const startTime = clamp(
            time,
            Math.max(0, previous.endTime - MAX_CLIP_SECONDS),
            previous.endTime - MIN_CLIP_SECONDS,
          );
          return { ...previous, startTime };
        }
        if (dragging === "end") {
          const endTime = clamp(
            time,
            previous.startTime + MIN_CLIP_SECONDS,
            Math.min(DEMO_VOD_DURATION_SECONDS, previous.startTime + MAX_CLIP_SECONDS),
          );
          return { ...previous, endTime };
        }
        const span = previous.endTime - previous.startTime;
        const startTime = clamp(time - span / 2, 0, DEMO_VOD_DURATION_SECONDS - span);
        return { startTime, endTime: startTime + span };
      });
    };

    const onUp = () => setDragging(null);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, clip, view]);

  const clipDuration = clip ? Math.round(clip.endTime - clip.startTime) : 0;
  const visibleEvents = events.filter((event) => event.offsetSeconds >= view.start && event.offsetSeconds <= view.end);
  const legendCounts = events.reduce<Record<string, { count: number; color: string }>>((acc, event) => {
    acc[event.label] = { count: (acc[event.label]?.count ?? 0) + 1, color: event.color };
    return acc;
  }, {});

  return (
    <div
      ref={rootRef}
      className="overflow-hidden rounded-2xl border bg-card/40"
      onPointerDownCapture={() => {
        touchedRef.current = true;
      }}
      onKeyDownCapture={() => {
        touchedRef.current = true;
      }}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
        </span>
        <span className="truncate font-mono text-[10px] text-muted-foreground">
          streamwizard.org/dashboard/vods/{demoVodMeta.id}
        </span>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,210px)]">
        <div className="min-w-0 p-3">
          {/* Stand-in for the VOD player: deliberately a panel, not a video. */}
          <div className="relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-black to-zinc-900 px-3 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{demoVodMeta.title}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {demoVodMeta.category} · {demoVodMeta.duration} · {demoVodMeta.views.toLocaleString()} views
                </p>
              </div>
              <Badge variant="secondary" className="h-5 shrink-0 text-[10px]">
                VOD
              </Badge>
            </div>
            <p className="mt-4 text-center font-mono text-2xl tabular-nums text-white/90">
              {formatOffset(Math.floor(currentTime))}
            </p>
            <p className="mt-1 text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              {clip ? "Looping the selection" : "Playhead position"}
            </p>
          </div>

          {/* Controls */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => {
                track("play_toggled");
                setIsPlaying((playing) => !playing);
              }}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setIsMuted((muted) => !muted)}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </Button>

            {clip ? (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={cancelClip}>
                Cancel Clip
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className={cn("gap-1.5 text-xs", !hasClipped && "text-amber-300 ring-1 ring-amber-400/50")}
                onClick={() => startClipAt(currentTime)}
              >
                <Scissors className="size-3.5" />
                Create Clip
              </Button>
            )}

            <div className="ml-auto flex items-center gap-1.5">
              <span className="hidden text-[10px] text-muted-foreground sm:inline">Shift + scroll to zoom</span>
              <span className="font-mono text-[10px] text-muted-foreground">Zoom: {zoom.toFixed(1)}x</span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => changeZoom(1 / 1.5)}
                disabled={zoom <= 1.01}
                aria-label="Zoom out"
              >
                <ZoomOut className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => changeZoom(1.5)}
                disabled={zoom >= MAX_ZOOM - 0.01}
                aria-label="Zoom in"
              >
                <ZoomIn className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Timeline */}
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div
                ref={trackRef}
                onClick={(event) => {
                  if (suppressClickRef.current) return;
                  seekTo(timeFromEvent(event.clientX));
                }}
                onMouseDown={onTrackMouseDown}
                onTouchStart={onTrackTouchStart}
                role="slider"
                tabIndex={0}
                aria-label="VOD timeline"
                aria-valuemin={0}
                aria-valuemax={DEMO_VOD_DURATION_SECONDS}
                aria-valuenow={Math.floor(currentTime)}
                aria-valuetext={formatOffset(Math.floor(currentTime))}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight") seekTo(currentTime + (clip ? 1 : 60));
                  if (event.key === "ArrowLeft") seekTo(currentTime - (clip ? 1 : 60));
                }}
                className={cn(
                  "relative mt-3 h-12 touch-none overflow-hidden rounded-md border border-border bg-muted/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  panning ? "cursor-grabbing" : zoom > 1.01 ? "cursor-grab" : "cursor-pointer",
                )}
              >
                {/* Watched portion */}
                <div
                  className="absolute inset-y-0 left-0 bg-purple-600/60"
                  style={{ width: `${clamp(timeToPercent(currentTime), 0, 100)}%` }}
                />

                {/* Muted audio and ad breaks */}
                {demoVodSegments.map((segment, index) => {
                  const style = SEGMENT_STYLES[segment.type];
                  const left = timeToPercent(segment.startSeconds);
                  const width = timeToPercent(segment.endSeconds) - left;
                  if (left > 100 || left + width < 0) return null;

                  return (
                    <div
                      key={`${segment.type}-${index}`}
                      className={cn("absolute inset-y-0", style.className)}
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 0.4)}%`,
                        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 2px, ${style.stripe} 2px, ${style.stripe} 4px)`,
                      }}
                      title={`${style.label}: ${formatOffset(segment.startSeconds)} - ${formatOffset(segment.endSeconds)}`}
                    />
                  );
                })}

                {/* Event markers */}
                {visibleEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={(mouseEvent) => {
                      mouseEvent.stopPropagation();
                      seekTo(event.offsetSeconds);
                    }}
                    style={{ left: `${timeToPercent(event.offsetSeconds)}%` }}
                    title={`${event.label} · ${formatOffset(event.offsetSeconds)}`}
                    className={cn(
                      "absolute top-1.5 size-2.5 -translate-x-1/2 rounded-full ring-1 ring-white/70 transition-transform hover:scale-150",
                      event.color,
                    )}
                  >
                    <span className="sr-only">
                      {event.label} at {formatOffset(event.offsetSeconds)}
                    </span>
                  </button>
                ))}

                {/* Clip selection */}
                {clip ? (
                  <>
                    <div
                      className="absolute inset-y-0 left-0 bg-black/50"
                      style={{ width: `${clamp(timeToPercent(clip.startTime), 0, 100)}%` }}
                    />
                    <div
                      className="absolute inset-y-0 right-0 bg-black/50"
                      style={{ width: `${clamp(100 - timeToPercent(clip.endTime), 0, 100)}%` }}
                    />
                    <div
                      data-clip-handle
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        setDragging("middle");
                      }}
                      onClick={(event) => event.stopPropagation()}
                      className={cn(
                        "absolute inset-y-0 border-y-2 border-purple-500/50 bg-purple-500/20",
                        dragging === "middle"
                          ? "cursor-grabbing bg-purple-500/40"
                          : "cursor-grab hover:bg-purple-500/30",
                      )}
                      style={{
                        left: `${clamp(timeToPercent(clip.startTime), 0, 100)}%`,
                        width: `${clamp(timeToPercent(clip.endTime) - timeToPercent(clip.startTime), 0, 100)}%`,
                      }}
                    />
                    {(["start", "end"] as const).map((edge) => (
                      <div
                        key={edge}
                        data-clip-handle
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          setDragging(edge);
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className={cn(
                          "absolute inset-y-0 z-10 flex w-4 cursor-ew-resize items-center justify-center rounded-sm bg-white shadow-lg",
                          dragging === edge && "bg-gray-200",
                        )}
                        style={{
                          left: `calc(${clamp(
                            timeToPercent(edge === "start" ? clip.startTime : clip.endTime),
                            0,
                            100,
                          )}% - 8px)`,
                        }}
                      >
                        <GripVertical className="size-3.5 text-purple-600" />
                      </div>
                    ))}
                  </>
                ) : null}

                {/* Playhead */}
                <span
                  className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow"
                  style={{ left: `${clamp(timeToPercent(currentTime), 0, 100)}%` }}
                />
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuLabel className="font-mono text-xs">{formatOffset(Math.floor(currentTime))}</ContextMenuLabel>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => startClipAt(currentTime)}>Create Clip Here</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>

          {/* Ruler */}
          <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
            {rulerLabels(view).map((seconds) => (
              <span key={seconds}>{formatOffset(Math.floor(seconds))}</span>
            ))}
          </div>

          {/* Readout, same line the dashboard prints under the track */}
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            {clip ? (
              <>
                <span>{formatOffset(Math.floor(clip.startTime))}</span>
                <span className="text-purple-400">
                  Clip: {clipDuration}s ({MIN_CLIP_SECONDS}s - {MAX_CLIP_SECONDS}s)
                </span>
                <span>{formatOffset(Math.floor(clip.endTime))}</span>
              </>
            ) : (
              <>
                <span>{formatOffset(Math.floor(view.start))}</span>
                <span>{formatOffset(Math.floor(currentTime))}</span>
                <span>{formatOffset(Math.floor(view.end))}</span>
              </>
            )}
          </div>

          {/* Clip title + save, the dashboard's clip-mode row */}
          {clip ? (
            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border bg-card p-2">
              <div className="min-w-[160px] flex-1">
                <label
                  htmlFor="vod-clip-title"
                  className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground"
                >
                  Clip Title
                </label>
                <Input
                  id="vod-clip-title"
                  value={clipTitle}
                  onChange={(event) => setClipTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") saveClip();
                  }}
                  placeholder="Add a title (required)"
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <Button variant="outline" size="sm" className="text-xs" onClick={cancelClip}>
                Cancel
              </Button>
              <Button size="sm" className="text-xs" disabled={!clipTitle.trim()} onClick={saveClip}>
                Save Clip
              </Button>
            </div>
          ) : null}

          {/* Legend */}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 border-t pt-2 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="h-3 w-4 rounded-sm bg-purple-600/60" />
              <span className="text-muted-foreground">Progress</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-1 rounded-sm bg-white shadow" />
              <span className="text-muted-foreground">Playhead</span>
            </span>
            {(["muted", "ad_break"] as const).map((type) => {
              const count = demoVodSegments.filter((segment) => segment.type === type).length;
              if (count === 0) return null;
              const style = SEGMENT_STYLES[type];
              return (
                <span key={type} className="flex items-center gap-1">
                  <span
                    className={cn("h-3 w-4 rounded-sm border", style.swatch)}
                    style={{
                      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 2px, ${style.stripe} 2px, ${style.stripe} 4px)`,
                    }}
                  />
                  <span className="text-muted-foreground">
                    {style.label} ({count})
                  </span>
                </span>
              );
            })}
            {clip ? (
              <span className="flex items-center gap-1">
                <span className="h-3 w-4 rounded-sm border border-purple-500/50 bg-purple-500/20" />
                <span className="text-muted-foreground">Clip Selection</span>
              </span>
            ) : null}
            <span className="h-3 w-px bg-border" />
            {Object.entries(legendCounts).map(([label, info]) => (
              <span key={label} className="flex items-center gap-1">
                <span className={cn("size-2.5 rounded-full ring-1 ring-white/70", info.color)} />
                <span className="text-muted-foreground">
                  {label} ({info.count})
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Stream events panel */}
        <div className="border-t border-border/60 p-3 xl:border-l xl:border-t-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-medium">Stream Events</h4>
            <Badge variant="secondary" className="h-5 text-[10px]">
              {events.length}
            </Badge>

            {/* Event Type Filters, as components/vods/event-type-filter.tsx
                writes them: quick actions on top, one checkbox row per type. */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="ml-auto h-7 gap-1.5 px-2 text-[11px]">
                  <Filter className="size-3" />
                  Filters
                  {selectedTypes.length < totalTypes && (
                    <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                      {selectedTypes.length}/{totalTypes}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Event Type Filters</h4>
                    <p className="text-xs text-muted-foreground">
                      Select which events to show in the timeline and events panel
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={hiddenTypes.length === 0}
                      onClick={() => setHiddenTypes([])}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={selectedTypes.length === 0}
                      onClick={() => setHiddenTypes([...typeCounts.keys()])}
                    >
                      Clear All
                    </Button>
                  </div>

                  <div className="max-h-[260px] space-y-1 overflow-y-auto">
                    {[...typeCounts.entries()].map(([type, info]) => {
                      const Icon = EVENT_ICONS[type] ?? Filter;
                      const isChecked = !hiddenTypes.includes(type);

                      return (
                        <label
                          key={type}
                          className="flex cursor-pointer items-center gap-3 rounded-md p-1.5 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() =>
                              setHiddenTypes((previous) =>
                                previous.includes(type)
                                  ? previous.filter((hidden) => hidden !== type)
                                  : [...previous, type],
                              )
                            }
                          />
                          <span
                            className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", info.color)}
                          >
                            <Icon className="size-3 text-white" aria-hidden="true" />
                          </span>
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="truncate text-sm font-medium">{type}</span>
                            <Badge variant="secondary" className="text-xs">
                              {info.count}
                            </Badge>
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {selectedTypes.length < totalTypes && (
                    <div className="border-t pt-2 text-xs text-muted-foreground">
                      Showing {selectedTypes.length} of {totalTypes} event types
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {events.length === 0 ? (
            <p className="mt-3 text-[11px] text-muted-foreground">
              No events recorded for this stream or no filters are selected
            </p>
          ) : null}

          <ul className="mt-2 max-h-[260px] space-y-0.5 overflow-y-auto pr-1">
            {events.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => seekTo(event.offsetSeconds)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-accent/40",
                    event.offsetSeconds < currentTime && "opacity-60",
                  )}
                >
                  <span className={cn("mt-1 size-2 shrink-0 rounded-full", event.color)} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[11px]">{event.label}</span>
                      <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
                        {formatOffset(event.offsetSeconds)}
                      </span>
                    </span>
                    {event.detail ? (
                      <span className="block truncate text-[10px] text-muted-foreground">{event.detail}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60 px-3 py-1.5 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
          Try it: press play, Create Clip, drag the handles · Shift + scroll zooms
        </p>
      </div>
    </div>
  );
}
