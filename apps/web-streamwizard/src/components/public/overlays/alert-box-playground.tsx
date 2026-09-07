"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useInView } from "motion/react";
import { cn } from "@repo/ui";
import {
  ALERT_ANIMATIONS_IN,
  ALERT_LAYOUTS,
  type AlertAnimationIn,
  type AlertLayout,
} from "@repo/ui/overlay";
import {
  BadgeCheck,
  ChartColumn,
  Clapperboard,
  Crown,
  Dices,
  Flame,
  Forward,
  Gem,
  Gift,
  Hammer,
  HandHeart,
  Heart,
  Medal,
  Megaphone,
  PartyPopper,
  Radio,
  Repeat2,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  Target,
  Ticket,
  TrainFront,
} from "lucide-react";
import { type DemoAlert } from "../home/overlay-demo-alert";
import {
  ALERT_CATALOG,
  ALERT_TIERS,
  CATALOG_ALERTS,
  CATEGORY_OF_INDEX,
  defaultTierIndex,
  type AlertCategoryId,
} from "./alert-catalog";
import { useDemoTracking } from "../analytics/use-demo-tracking";

/*
 * The alert box's own demo, cycling the full 29-event roadmap catalog from
 * alert-catalog.ts (the SW-198 list; the built-in widget fires six of them
 * today, the rest is what it is growing into). 29 chips in one row is a wall,
 * so the chips sit behind four category tabs; the auto-cycle walks all of
 * them and drags the active tab along, and picking a tab by hand holds it for
 * a while so the cycle does not yank the list away mid-read. The layout and
 * entrance controls come from the real widget config, so those cannot drift
 * from the settings panel.
 *
 * Nothing starts playing until the frame is on screen, so server and client
 * paint the same first frame.
 */

interface MediaLook {
  icon: typeof Heart;
  tint: string;
}

/** The media slot per notice type: a gradient standing in for the streamer's own file. */
const MEDIA_LOOKS: Record<string, MediaLook> = {
  Follow: { icon: Heart, tint: "from-rose-500/60 to-purple-600/40" },
  "Watch streak": { icon: Flame, tint: "from-orange-500/60 to-rose-600/40" },
  "Community gift": { icon: PartyPopper, tint: "from-amber-500/60 to-purple-600/40" },
  "Charity donation": { icon: HandHeart, tint: "from-emerald-500/60 to-teal-600/40" },
  "Bits badge": { icon: Medal, tint: "from-teal-500/60 to-purple-600/40" },
  "Pay it forward": { icon: Forward, tint: "from-sky-500/60 to-indigo-600/40" },
  Modiversary: { icon: Shield, tint: "from-indigo-500/60 to-purple-600/40" },
  "Prime upgrade": { icon: Crown, tint: "from-amber-500/60 to-sky-600/40" },
  Resub: { icon: Repeat2, tint: "from-indigo-500/60 to-sky-600/40" },
  Sub: { icon: Star, tint: "from-purple-500/60 to-indigo-600/40" },
  Raid: { icon: Swords, tint: "from-red-500/60 to-amber-600/40" },
  "Gift sub": { icon: Gift, tint: "from-amber-500/60 to-rose-600/40" },
  "Gift upgrade": { icon: Sparkles, tint: "from-purple-500/60 to-rose-600/40" },
  Announcement: { icon: Megaphone, tint: "from-sky-500/60 to-teal-600/40" },
  Cheer: { icon: Gem, tint: "from-teal-500/60 to-purple-600/40" },
  Redemption: { icon: Ticket, tint: "from-purple-500/60 to-teal-600/40" },
  "Hype train start": { icon: TrainFront, tint: "from-amber-500/60 to-purple-600/40" },
  "Hype train end": { icon: Flame, tint: "from-orange-500/60 to-purple-600/40" },
  "Shoutout received": { icon: Radio, tint: "from-sky-500/60 to-purple-600/40" },
  "Shoutout sent": { icon: Megaphone, tint: "from-indigo-500/60 to-teal-600/40" },
  "Ad break": { icon: Clapperboard, tint: "from-slate-500/60 to-sky-600/40" },
  "Poll start": { icon: ChartColumn, tint: "from-teal-500/60 to-indigo-600/40" },
  "Poll winner": { icon: ChartColumn, tint: "from-emerald-500/60 to-teal-600/40" },
  "Prediction start": { icon: Dices, tint: "from-purple-500/60 to-sky-600/40" },
  "Prediction result": { icon: Dices, tint: "from-amber-500/60 to-emerald-600/40" },
  "Goal achieved": { icon: Target, tint: "from-emerald-500/60 to-purple-600/40" },
  Ban: { icon: Hammer, tint: "from-red-500/60 to-slate-600/40" },
  "VIP added": { icon: BadgeCheck, tint: "from-rose-500/60 to-amber-600/40" },
  "Mod added": { icon: ShieldCheck, tint: "from-emerald-500/60 to-indigo-600/40" },
};

const FALLBACK_LOOK: MediaLook = { icon: Star, tint: "from-purple-500/60 to-indigo-600/40" };

const LAYOUT_LABELS: Record<AlertLayout, string> = {
  stacked: "Stacked",
  row: "Row",
  overlay: "Text on media",
};

const ANIMATION_LABELS: Record<AlertAnimationIn, string> = {
  fade: "Fade",
  slide_up: "Slide up",
  slide_down: "Slide down",
  zoom: "Zoom",
  bounce: "Bounce",
};

const ANIM_IN: Record<AlertAnimationIn, { opacity: number; scale?: number; y?: number }> = {
  fade: { opacity: 0 },
  zoom: { opacity: 0, scale: 0.6 },
  bounce: { opacity: 0, scale: 0.4 },
  slide_up: { opacity: 0, y: 28 },
  slide_down: { opacity: 0, y: -28 },
};

const ANIM_TRANSITION: Record<AlertAnimationIn, object> = {
  fade: { duration: 0.45, ease: "easeOut" },
  zoom: { duration: 0.35, ease: "easeOut" },
  bounce: { type: "spring", stiffness: 420, damping: 14 },
  slide_up: { duration: 0.4, ease: "easeOut" },
  slide_down: { duration: 0.4, ease: "easeOut" },
};

const SHOW_MS = 4200;
const GAP_MS = 2600;

const trackId = (alert: DemoAlert) => alert.kind.toLowerCase().replace(/\s+/g, "_");

function MediaTile({ alert, boost, className }: { alert: DemoAlert; boost?: boolean; className?: string }) {
  const { icon: Icon, tint } = MEDIA_LOOKS[alert.kind] ?? FALLBACK_LOOK;
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-lg border border-white/[0.14] bg-gradient-to-br",
        // The top milestone is a different alert, so it looks like one: gold.
        boost ? "from-amber-400/70 to-purple-600/50 ring-2 ring-amber-300/50" : tint,
        className,
      )}
    >
      <Icon className="h-1/3 w-1/3 text-white/85 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
    </div>
  );
}

function AlertText({ alert, align = "center" }: { alert: DemoAlert; align?: "left" | "center" }) {
  return (
    <div className={align === "left" ? "min-w-0 text-left" : "min-w-0 text-center"}>
      <p className="mb-0.5 text-[6px] font-semibold uppercase tracking-[0.22em] text-[#b9b9c6] @md:text-[8px] @3xl:mb-1 @3xl:text-[10px]">
        {alert.kind}
      </p>
      <p className="line-clamp-2 text-balance text-[11px] font-bold leading-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] @md:text-sm @xl:text-base @3xl:text-2xl">
        <span className="text-[#9e7aff]">{alert.name}</span>
        {alert.rest}
      </p>
      {alert.message ? (
        <p className="mt-0.5 truncate text-[8px] text-[#d4d4d8] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] @md:text-[10px] @3xl:text-sm">
          {alert.message}
        </p>
      ) : null}
      <span
        className={cn(
          "mt-1 block h-0.5 w-8 rounded-full bg-[#9e7aff] @3xl:mt-1.5 @3xl:w-12",
          align === "center" && "mx-auto",
        )}
      />
    </div>
  );
}

/** One alert, drawn in the shape the picked layout gives it. */
function PlayingAlert({ alert, layout, boost }: { alert: DemoAlert; layout: AlertLayout; boost?: boolean }) {
  if (layout === "row") {
    return (
      <div className="flex items-center gap-2 @md:gap-3 @3xl:gap-4">
        <MediaTile alert={alert} boost={boost} className="aspect-square w-[14%] shrink-0 @3xl:w-[12%]" />
        <AlertText alert={alert} align="left" />
      </div>
    );
  }
  if (layout === "overlay") {
    return (
      <div className="relative flex aspect-[5/2] w-[52%] items-center justify-center @md:w-[46%]">
        <MediaTile alert={alert} boost={boost} className="absolute inset-0" />
        <div className="absolute inset-0 rounded-lg bg-black/45" />
        <div className="relative px-2">
          <AlertText alert={alert} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1.5 @md:gap-2">
      <MediaTile
        alert={alert}
        boost={boost}
        className={cn("aspect-square", boost ? "w-[15%] @3xl:w-[13%]" : "w-[13%] @3xl:w-[11%]")}
      />
      <AlertText alert={alert} />
    </div>
  );
}

interface Play {
  /** Index into CATALOG_ALERTS, or null in the gap between two alerts. */
  idx: number | null;
  /** The most recently shown index, so the active tab has a category during the gap. */
  last: number;
  /** Bumped every show so refiring the same event still replays the entrance. */
  n: number;
}

function ControlGroup<T extends string>({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div
        role="group"
        aria-label={label}
        className="flex flex-wrap rounded-md border border-white/[0.08] bg-white/[0.03] p-0.5 font-mono text-[10px] uppercase tracking-widest"
      >
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={value === opt}
            onClick={() => onChange(opt)}
            className={cn(
              "rounded px-2 py-1 transition-colors",
              value === opt ? "bg-purple-500/15 text-purple-300" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {labels[opt]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** How long a hand-picked tab holds before the cycle may drag it along again. */
const TAB_HOLD_MS = 10000;

export function AlertBoxPlayground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-64px" });
  const track = useDemoTracking("alert_box");

  // Product defaults: a fresh alert widget ships stacked with a zoom entrance.
  const [layout, setLayout] = useState<AlertLayout>("stacked");
  const [anim, setAnim] = useState<AlertAnimationIn>("zoom");
  const [play, setPlay] = useState<Play>({ idx: null, last: 0, n: 0 });
  const [tabOverride, setTabOverride] = useState<AlertCategoryId | null>(null);
  /** Picked milestone per event kind; unset = the tier matching the shared wording. */
  const [tierChoice, setTierChoice] = useState<Record<string, number>>({});

  const nextIdx = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const clearHold = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setTabOverride(null);
  }, []);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  /** Start (or restart) the cycle at `startIdx`, first alert after `delay`. */
  const run = useCallback(
    (startIdx: number, delay: number) => {
      stop();
      nextIdx.current = startIdx;
      const show = () => {
        const idx = nextIdx.current;
        setPlay((p) => ({ idx, last: idx, n: p.n + 1 }));
        nextIdx.current = (idx + 1) % CATALOG_ALERTS.length;
        timer.current = setTimeout(hide, SHOW_MS);
      };
      const hide = () => {
        setPlay((p) => ({ ...p, idx: null }));
        timer.current = setTimeout(show, GAP_MS);
      };
      setPlay((p) => ({ ...p, idx: null }));
      timer.current = setTimeout(show, delay);
    },
    [stop],
  );

  useEffect(() => {
    if (!inView) return;
    run(nextIdx.current, 900);
    return () => {
      stop();
      setPlay((p) => ({ ...p, idx: null }));
    };
  }, [inView, run, stop]);

  const fire = (idx: number) => {
    track(`fire_${trackId(CATALOG_ALERTS[idx])}`);
    clearHold();
    run(idx, 150);
  };

  /** A changed control replays the current alert so the change is visible now. */
  const replay = () => {
    run(play.idx ?? play.last, 150);
  };

  /** Hold a hand-picked tab so the cycle does not yank the list away mid-read. */
  const pickTab = (id: AlertCategoryId) => {
    track(`tab_${id}`);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setTabOverride(id);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setTabOverride(null);
    }, TAB_HOLD_MS);
  };

  const activeTab = tabOverride ?? CATEGORY_OF_INDEX[play.idx ?? play.last];
  const activeCategory = ALERT_CATALOG.find((c) => c.id === activeTab) ?? ALERT_CATALOG[0];

  /* Milestones: the current event's amount tiers, if it has any. Picking one
     replays the event as that tier's alert: different text, different media,
     the top tier drawn gold. The row follows whatever fired last, so clicking
     Resub and then walking the months is the natural path through it. */
  const currentBase = CATALOG_ALERTS[play.idx ?? play.last];
  const currentTiers = ALERT_TIERS[currentBase.kind];
  const currentTierIdx = tierChoice[currentBase.kind] ?? (currentTiers ? defaultTierIndex(currentTiers) : 0);

  const pickTier = (idx: number) => {
    track(`tier_${trackId(currentBase)}`);
    setTierChoice((prev) => ({ ...prev, [currentBase.kind]: idx }));
    run(CATALOG_ALERTS.indexOf(currentBase), 150);
  };

  const playingBase = play.idx !== null ? CATALOG_ALERTS[play.idx] : null;
  const playingTiers = playingBase ? ALERT_TIERS[playingBase.kind] : undefined;
  const playingTier = playingBase && playingTiers
    ? playingTiers[tierChoice[playingBase.kind] ?? defaultTierIndex(playingTiers)]
    : undefined;
  const shownAlert = playingBase
    ? playingTier
      ? { ...playingBase, rest: playingTier.rest, message: playingTier.message, media: playingTier.media }
      : playingBase
    : null;

  return (
    <div ref={rootRef} className="mx-auto max-w-4xl">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2 shadow-[0_16px_48px_-16px_rgba(158,122,255,0.25)] sm:p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1 sm:mb-3">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500 motion-reduce:animate-none" />
            Alert box · {CATALOG_ALERTS.length} events, one widget
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Click one</p>
        </div>

        <MotionConfig reducedMotion="user">
          <div
            role="img"
            aria-label="The alert box firing on a dark stream scene: follows, subs, cheers, raids and the other Twitch notices, each with its media, a title, and the viewer's message"
            className="@container relative aspect-video select-none overflow-hidden rounded-lg bg-black"
          >
            <div aria-hidden="true" className="absolute inset-0">
              {/* Enough scene to read as a stream, dark enough to keep the alert the subject. */}
              <div className="absolute inset-0 bg-[linear-gradient(160deg,#171226_0%,#101a2b_55%,#0d1117_100%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(158,122,255,0.14),transparent_55%)]" />
              <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/60 to-transparent" />

              <div className="absolute inset-x-[8%] top-[24%] flex justify-center @md:inset-x-[12%]">
                <AnimatePresence mode="wait">
                  {play.idx !== null ? (
                    <motion.div
                      key={play.n}
                      initial={ANIM_IN[anim]}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.3 } }}
                      transition={ANIM_TRANSITION[anim]}
                      className="w-full"
                    >
                      <div className="flex justify-center">
                        <div className="w-full">
                          {shownAlert ? (
                            <PlayingAlert alert={shownAlert} layout={layout} boost={playingTier?.boost} />
                          ) : null}
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </MotionConfig>

        {/* The tabs group the catalog, the chips are the active group, and the
            toggles are real settings: layout and entrance are per-event options
            in the alert box's config. */}
        <div className="mt-2 space-y-2 px-1 pb-1 sm:mt-3">
          <div
            role="group"
            aria-label="Alert categories"
            className="flex flex-wrap rounded-md border border-white/[0.08] bg-white/[0.03] p-0.5 font-mono text-[10px] uppercase tracking-widest"
          >
            {ALERT_CATALOG.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={activeTab === category.id}
                onClick={() => pickTab(category.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2 py-1 transition-colors",
                  activeTab === category.id
                    ? "bg-purple-500/15 text-purple-300"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {category.label}
                <span className={cn("text-[9px]", activeTab === category.id ? "text-purple-300/70" : "opacity-60")}>
                  {category.alerts.length}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeCategory.alerts.map((alert) => {
              const idx = CATALOG_ALERTS.indexOf(alert);
              return (
                <button
                  key={alert.kind}
                  type="button"
                  onClick={() => fire(idx)}
                  aria-pressed={play.idx === idx}
                  className={cn(
                    "rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors",
                    play.idx === idx
                      ? "border-purple-500/50 bg-purple-500/15 text-purple-300"
                      : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:border-white/[0.16] hover:text-foreground",
                  )}
                >
                  {alert.kind}
                </button>
              );
            })}
          </div>

          {/* Milestones: the same event at different amounts is a different
              alert. The row tracks whatever fired last; events without an
              amount get the hint instead of an empty hole. */}
          <div className="flex min-h-7 flex-wrap items-center gap-2">
            {currentTiers ? (
              <>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {currentBase.kind} milestones
                </span>
                <div
                  role="group"
                  aria-label={`${currentBase.kind} milestones. Press one to replay the alert at that amount.`}
                  className="flex flex-wrap rounded-md border border-white/[0.08] bg-white/[0.03] p-0.5 font-mono text-[10px] uppercase tracking-widest"
                >
                  {currentTiers.map((t, i) => (
                    <button
                      key={t.label}
                      type="button"
                      aria-pressed={currentTierIdx === i}
                      onClick={() => pickTier(i)}
                      className={cn(
                        "rounded px-2 py-1 transition-colors",
                        currentTierIdx === i
                          ? t.boost
                            ? "bg-amber-400/15 text-amber-300"
                            : "bg-purple-500/15 text-purple-300"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                  Demo picks. Yours are whatever you type.
                </span>
              </>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                Milestones: fire a resub, cheer, raid, streak, gift bomb or modiversary
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <ControlGroup
              label="Layout"
              options={ALERT_LAYOUTS}
              labels={LAYOUT_LABELS}
              value={layout}
              onChange={(next) => {
                track(`layout_${next}`);
                setLayout(next);
                replay();
              }}
            />
            <ControlGroup
              label="Entrance"
              options={ALERT_ANIMATIONS_IN}
              labels={ANIMATION_LABELS}
              value={anim}
              onChange={(next) => {
                track(`anim_${next}`);
                setAnim(next);
                replay();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
