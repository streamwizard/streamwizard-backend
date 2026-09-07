"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDemoTracking } from "../analytics/use-demo-tracking";
import Image from "next/image";
import Link from "next/link";
import { motion, useAnimationFrame, useMotionValue, useTransform, useReducedMotion } from "motion/react";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Eye, Play, Scissors, User } from "lucide-react";
import { BsTwitch } from "react-icons/bs";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { formatDate } from "@/lib/format";
import type { RealClipCard } from "./demo-data";

/* Same parent list the product's clip players use (twitch-clip-dialog.tsx). */
const EMBED_PARENTS = "&parent=localhost&parent=streamwizard.org&parent=staging.streamwizard.org&autoplay=true";

function ClipCard({ clip, onOpen, tabIndex }: { clip: RealClipCard; onOpen: () => void; tabIndex?: number }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      tabIndex={tabIndex}
      className="group w-60 shrink-0 cursor-pointer rounded-xl border border-white/[0.07] bg-white/[0.04] p-2.5 text-left transition-colors hover:border-white/[0.14] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      aria-label={`Play clip: ${clip.title}`}
    >
      <div className="relative aspect-video overflow-hidden rounded-lg border border-white/[0.06] bg-black">
        <Image
          src={clip.thumbnailUrl}
          alt=""
          fill
          sizes="240px"
          className="object-cover"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
          <Play
            className="h-8 w-8 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        </span>
        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
          {clip.duration}
        </span>
        <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
          <Eye className="h-2.5 w-2.5" aria-hidden="true" />
          {clip.views}
        </span>
      </div>
      <p className="mt-2 truncate text-sm font-medium">{clip.title}</p>
      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
        <Scissors className="h-3 w-3 shrink-0" aria-hidden="true" />
        {clip.creator}
      </p>
      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-purple-300/90">
        <BsTwitch className="h-3 w-3 shrink-0" aria-hidden="true" />
        {clip.broadcaster}
      </p>
    </button>
  );
}

/**
 * The clip player behind both the marquee and the clips-page demo below it:
 * Twitch embed, clip metadata, and arrow-key/button paging through the list it
 * was opened from.
 */
export function ClipShowcaseDialog({
  clips,
  index,
  onIndexChange,
  onClose,
}: {
  clips: RealClipCard[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const clip = index == null ? null : clips[index];
  const track = useDemoTracking("clips");

  // Shared with the folders mock, so the open lands here rather than on each
  // card: one place, both demos.
  useEffect(() => {
    if (index != null) track("clip_opened");
  }, [index, track]);

  const step = useCallback(
    (delta: number) => {
      if (index == null || clips.length === 0) return;
      track("clip_stepped");
      onIndexChange((index + delta + clips.length) % clips.length);
    },
    [index, clips.length, onIndexChange, track],
  );

  // Window-level so the arrows keep working after the Twitch iframe takes
  // focus; a handler on the dialog would stop seeing key events then.
  useEffect(() => {
    if (index == null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, step]);

  return (
    <Dialog open={clip != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[95vw] max-w-4xl gap-0 overflow-hidden p-0 sm:max-w-4xl"
        // Radix would focus the iframe (first tabbable); once focus is inside
        // it, arrow keys and Escape die cross-origin. Keep focus on the dialog.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {clip ? (
          <div className="flex max-h-[90vh] min-w-0 flex-col">
            <div className="relative aspect-video w-full shrink-0 bg-black">
              {clip.embedUrl ? (
                <iframe
                  key={clip.id}
                  src={`${clip.embedUrl}${EMBED_PARENTS}`}
                  allowFullScreen
                  className="absolute inset-0 size-full"
                  title={clip.title}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  This clip can&apos;t be played here.
                </div>
              )}
              <Badge className="absolute left-2 top-2 bg-primary text-primary-foreground">
                {clip.duration}
              </Badge>
            </div>

            <div className="min-w-0 space-y-4 overflow-y-auto p-4 sm:p-6">
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="line-clamp-2 text-lg leading-snug">{clip.title}</DialogTitle>
                <DialogDescription className="sr-only">
                  Clip by {clip.creator} on {clip.broadcaster}&apos;s channel.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <User className="size-4" aria-hidden="true" />
                  {clip.creator}
                </span>
                <span className="flex items-center gap-1.5">
                  <BsTwitch className="size-4" aria-hidden="true" />
                  {clip.broadcaster}
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye className="size-4" aria-hidden="true" />
                  {clip.views.toLocaleString()} views
                </span>
                {clip.createdAt && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-4" aria-hidden="true" />
                    {formatDate(clip.createdAt)}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon-sm" onClick={() => step(-1)} aria-label="Previous clip">
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {index! + 1} / {clips.length}
                  </span>
                  <Button variant="outline" size="icon-sm" onClick={() => step(1)} aria-label="Next clip">
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
                {clip.url && (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={clip.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => track("clip_opened_on_twitch")}
                    >
                      <ExternalLink className="mr-2 size-4" aria-hidden="true" />
                      Open on Twitch
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <DialogTitle className="sr-only">Clip</DialogTitle>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* One full content-set scrolls past in this many seconds when idle
   (matches the old CSS marquee's --duration:48s). */
const LOOP_SECONDS = 48;
const DRAG_THRESHOLD_PX = 6;

/**
 * Infinite auto-scrolling strip the user can grab and fling. Idle motion is
 * constant (linear); a drag interrupts it instantly, and on release the fling
 * velocity decays back into the auto-scroll speed.
 */
function DraggableMarquee({ renderSet }: { renderSet: (clone: boolean) => React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(2);

  // Width of one content set (incl. trailing gap) — read inside the transform
  // every frame, so a ref rather than state.
  const setWidth = useRef(0);
  const autoSpeed = useRef(0); // px/s
  const velocity = useRef(0); // px/s, current strip velocity (negative = leftward)
  const hovering = useRef(false);
  const suppressClick = useRef(false);
  const drag = useRef<{ id: number; startX: number; lastX: number; lastT: number; active: boolean } | null>(null);

  const baseX = useMotionValue(0);
  const transform = useTransform(baseX, (v) => {
    const w = setWidth.current;
    if (!w) return "translate3d(0,0,0)";
    const wrapped = (((v % w) - w) % w); // keep in (-w, 0] so the loop is seamless
    return `translate3d(${wrapped}px,0,0)`;
  });

  useEffect(() => {
    const setEl = setRef.current;
    const containerEl = containerRef.current;
    if (!setEl || !containerEl) return;
    const measure = () => {
      const w = setEl.offsetWidth;
      if (!w) return;
      setWidth.current = w;
      autoSpeed.current = w / LOOP_SECONDS;
      setCopies(Math.max(2, Math.ceil(containerEl.offsetWidth / w) + 1));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(setEl);
    ro.observe(containerEl);
    return () => ro.disconnect();
  }, []);

  useAnimationFrame((_, delta) => {
    if (drag.current?.active) return;
    const dt = Math.min(delta, 64); // tab-switch deltas would teleport the strip
    const target = hovering.current ? 0 : -autoSpeed.current;
    velocity.current += (target - velocity.current) * (1 - Math.exp(-dt / 400));
    baseX.set(baseX.get() + (velocity.current * dt) / 1000);
  });

  return (
    <div
      ref={containerRef}
      className="cursor-grab touch-pan-y select-none overflow-hidden active:cursor-grabbing"
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        drag.current = { id: e.pointerId, startX: e.clientX, lastX: e.clientX, lastT: e.timeStamp, active: false };
        suppressClick.current = false;
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || e.pointerId !== d.id) return;
        if (!d.active) {
          if (Math.abs(e.clientX - d.startX) < DRAG_THRESHOLD_PX) return;
          // Only past the threshold does it become a drag — a plain press
          // stays a click on the card underneath.
          d.active = true;
          suppressClick.current = true;
          containerRef.current?.setPointerCapture(e.pointerId);
        }
        const dx = e.clientX - d.lastX;
        const dt = e.timeStamp - d.lastT;
        baseX.set(baseX.get() + dx);
        if (dt > 0) velocity.current = velocity.current * 0.8 + (dx / dt) * 1000 * 0.2;
        d.lastX = e.clientX;
        d.lastT = e.timeStamp;
      }}
      onPointerUp={(e) => {
        if (drag.current?.id === e.pointerId) drag.current = null;
      }}
      onPointerCancel={(e) => {
        if (drag.current?.id === e.pointerId) drag.current = null;
      }}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") hovering.current = true;
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") hovering.current = false;
      }}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          e.preventDefault();
          e.stopPropagation();
          suppressClick.current = false;
        }
      }}
    >
      <motion.div className="flex w-max py-2" style={{ transform }}>
        {Array.from({ length: copies }, (_, i) => (
          <div
            key={i}
            ref={i === 0 ? setRef : undefined}
            // Clones stay clickable (they're what's on screen most of the
            // time) but are invisible to keyboard and screen readers.
            aria-hidden={i > 0}
            className="flex shrink-0 gap-4 pr-4"
          >
            {renderSet(i > 0)}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export function ClipsMarquee({ clips }: { clips: RealClipCard[] }) {
  const reduceMotion = useReducedMotion();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // The server always renders the marquee (useReducedMotion is unknowable
  // there); swapping to the static row only after mount keeps hydration
  // clean. The strip only starts moving client-side, so nothing animates
  // before the swap.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const renderCards = (clone = false) =>
    clips.map((clip, i) => (
      <ClipCard
        key={clip.id}
        clip={clip}
        onOpen={() => setOpenIndex(i)}
        tabIndex={clone ? -1 : undefined}
      />
    ));

  return (
    <>
      {reduceMotion && mounted ? (
        <div className="flex gap-4 overflow-x-auto px-4 pb-2">{renderCards()}</div>
      ) : (
        <div className="relative">
          <DraggableMarquee renderSet={renderCards} />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-linear-to-r from-background to-transparent sm:w-32" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-linear-to-l from-background to-transparent sm:w-32" />
        </div>
      )}
      <ClipShowcaseDialog
        clips={clips}
        index={openIndex}
        onIndexChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
      />
    </>
  );
}
