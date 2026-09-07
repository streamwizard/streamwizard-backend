"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useInView } from "motion/react";
import { Eye } from "lucide-react";

/*
 * The moving parts of the widget cards: a clips rotator crossfading through
 * three clips, and a countdown next to a clock. Both tick only while on
 * screen and start from fixed values so the server frame matches the client.
 */

const CLIPS = [
  { title: "Almost died", creator: "toastcrumb", views: "2.1k", hue: "from-purple-500/40 to-slate-900/70" },
  { title: "Bridge jump, first try", creator: "ninetoad", views: "918", hue: "from-amber-500/30 to-slate-900/70" },
  { title: "Raid landed mid sentence", creator: "ModMothra", views: "1.4k", hue: "from-sky-500/30 to-slate-900/70" },
];

const CLIP_MS = 3400;

/** The clips montage on the CDN: real clips from a channel, cut back to back. */
const CLIPS_MONTAGE_URL = "https://cdn.streamwizard.org/public/vods/streamwizard-clips-480p.webm";

/**
 * `video` plays the real montage behind the display fields instead of the drawn
 * stand-in. Only the OBS window's Starting Soon scene asks for it: the marketing
 * frames stay drawings, so the clip is not on the critical path of a page nobody
 * scrolled to yet.
 */
export function ClipsRotatorMini({ video = false }: { video?: boolean } = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inView = useInView(ref, { margin: "-48px" });
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % CLIPS.length), CLIP_MS);
    return () => clearInterval(id);
  }, [inView]);

  // The montage runs start to finish and loops; only being off screen stops it.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (inView) {
      // Muted autoplay is allowed everywhere; the catch is for the odd browser
      // that still says no, where the drawn stand-in is the whole widget.
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [inView]);

  const clip = CLIPS[idx];
  const playing = video && !failed;

  return (
    <div
      ref={ref}
      role="img"
      aria-label="A clips widget rotating through clips from the channel, each showing its title, creator, and view count"
      className="@container relative aspect-video overflow-hidden rounded-lg border border-white/[0.07] bg-black"
    >
      {playing ? (
        <video
          ref={videoRef}
          src={CLIPS_MONTAGE_URL}
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <MotionConfig reducedMotion="user">
        <AnimatePresence initial={false}>
          <motion.div
            key={idx}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className={playing ? "absolute inset-0" : `absolute inset-0 bg-linear-to-br ${clip.hue}`}
          >
            {playing ? null : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.12),transparent_55%)]" />
            )}
            {/* Display fields: the bits the editor lets you place anywhere on the clip. */}
            {/* Below 20rem (inside the small demo frame) only the title and views fit. */}
            <div className="absolute left-2 top-2 max-w-[70%] truncate rounded bg-black/55 px-1.5 py-0.5 text-[8px] font-semibold text-white @xs:left-3 @xs:top-3 @xs:text-[10px]">
              {clip.title}
            </div>
            <div className="absolute bottom-3 left-3 hidden rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/85 @xs:block">
              clipped by {clip.creator}
            </div>
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[8px] tabular-nums text-white/85 @xs:bottom-3 @xs:right-3 @xs:text-[10px]">
              <Eye className="h-2.5 w-2.5 @xs:h-3 @xs:w-3" />
              {clip.views}
            </div>
          </motion.div>
        </AnimatePresence>
      </MotionConfig>
      {/* Progress dots, one per clip in the rotation */}
      <div aria-hidden="true" className="absolute right-2 top-2 flex gap-1 @xs:right-3 @xs:top-3">
        {CLIPS.map((c, i) => (
          <span
            key={c.title}
            className={"h-1 w-2 rounded-full transition-colors @xs:w-3 " + (i === idx ? "bg-white/90" : "bg-white/30")}
          />
        ))}
      </div>
    </div>
  );
}

// Starts at 9:58 so the countdown reads as "almost live", not as a timer nobody set.
const COUNTDOWN_START = 9 * 60 + 58;
const CLOCK_START = 19 * 3600 + 42 * 60 + 5;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function CountdownMini() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-48px" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [inView]);

  const remaining = Math.max(0, COUNTDOWN_START - tick);
  const clock = CLOCK_START + tick;
  const countdown = `${pad(Math.floor(remaining / 60))}:${pad(remaining % 60)}`;
  const time = `${pad(Math.floor(clock / 3600) % 24)}:${pad(Math.floor((clock % 3600) / 60))}:${pad(clock % 60)}`;

  return (
    <div
      ref={ref}
      role="img"
      aria-label="A countdown widget counting down to stream start next to a time widget showing the current time"
      className="grid grid-cols-2 gap-2"
    >
      <div aria-hidden="true" className="rounded-lg border border-white/[0.07] bg-black px-3 py-4 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Starting in</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-white">{countdown}</p>
      </div>
      <div aria-hidden="true" className="rounded-lg border border-white/[0.07] bg-black px-3 py-4 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Amsterdam</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-white">{time}</p>
      </div>
    </div>
  );
}

/*
 * The subathon timer and the goal bars, under the countdown on the same card.
 * A subathon clock only ever runs down, until an event puts time back on it;
 * the bump is the whole point, so one lands every few seconds here.
 */

// 4:12:37 left, so the hours column is doing something.
const SUBATHON_START = 4 * 3600 + 12 * 60 + 37;
// Seconds between the events that put time back on the clock, and how much.
const BUMP_EVERY = 9;
const BUMP_SECONDS = 10 * 60;

function clockHms(total: number) {
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

export function SubathonMini() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-48px" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [inView]);

  const bumps = Math.floor(tick / BUMP_EVERY);
  const remaining = Math.max(0, SUBATHON_START - tick + bumps * BUMP_SECONDS);
  // The badge stays up for a moment after the sub that caused it.
  const bumping = tick > 0 && tick % BUMP_EVERY < 2;

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`A subathon timer with ${clockHms(remaining)} left, gaining ten minutes every time a sub comes in`}
      className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-black px-3 py-3"
    >
      <div aria-hidden="true">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Subathon</p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-white">{clockHms(remaining)}</p>
      </div>
      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {bumping ? (
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              aria-hidden="true"
              className="rounded-md border border-purple-500/40 bg-purple-500/10 px-2 py-1 font-mono text-[11px] font-semibold text-purple-300"
            >
              +10:00
            </motion.span>
          ) : null}
        </AnimatePresence>
      </MotionConfig>
    </div>
  );
}

/* Where the goals start, and how often one more lands. */
const GOALS = [
  { label: "Followers", start: 1284, target: 1500, everySeconds: 6 },
  { label: "Subs", start: 62, target: 100, everySeconds: 19 },
];

export function GoalsMini() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-48px" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [inView]);

  const rows = GOALS.map((goal) => {
    const value = Math.min(goal.target, goal.start + Math.floor(tick / goal.everySeconds));
    return { ...goal, value, percent: (value / goal.target) * 100 };
  });

  return (
    <div
      ref={ref}
      role="img"
      aria-label={rows
        .map((row) => `A ${row.label.toLowerCase()} goal at ${row.value} of ${row.target}`)
        .join(", and ")}
      className="space-y-2.5 rounded-lg border border-white/[0.07] bg-black px-3 py-3"
    >
      {rows.map((row) => (
        <div key={row.label} aria-hidden="true">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{row.label}</span>
            <span className="font-mono text-[11px] tabular-nums text-white">
              {row.value.toLocaleString("en-US")}
              <span className="text-muted-foreground"> / {row.target.toLocaleString("en-US")}</span>
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <motion.div
              className="h-full rounded-full bg-[#9e7aff]"
              initial={false}
              animate={{ width: `${row.percent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// A short stretch of a walk: speed wobbles, distance climbs with it.
const WALK_START = { speedKmh: 4.8, distanceKm: 3.57 };

export function WalkingStatsMini() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-48px" });
  const [walk, setWalk] = useState(WALK_START);

  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => {
      setWalk((w) => {
        const speedKmh = Math.min(6.4, Math.max(3.4, w.speedKmh + (Math.random() - 0.5) * 0.7));
        return { speedKmh, distanceKm: w.distanceKm + speedKmh / 3600 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [inView]);

  const fields = [
    { label: "Speed", value: walk.speedKmh.toFixed(1), unit: "km/h" },
    { label: "Distance", value: walk.distanceKm.toFixed(2), unit: "km" },
    { label: "Location", value: "Haarlem" },
    { label: "Weather", value: "21°", unit: "Partly cloudy" },
  ];

  return (
    <div
      ref={ref}
      role="img"
      aria-label="An IRL overlay: heading and altitude in a corner, and a bar along the bottom with speed, distance, the city, and the weather from the phone's GPS"
      className="@container relative aspect-video overflow-hidden rounded-lg border border-white/[0.07] bg-[linear-gradient(160deg,#1b2440_0%,#2a1c3d_55%,#12161f_100%)]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(158,122,255,0.3),transparent_55%),radial-gradient(circle_at_75%_70%,rgba(255,189,122,0.18),transparent_50%)]"
      />
      <div aria-hidden="true" className="absolute right-3 top-3 space-y-0.5 text-right">
        <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[#b9b9c6]">
          Heading <span className="ml-1 text-[11px] normal-case tracking-normal text-white tabular-nums">212° SW</span>
        </p>
        <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[#b9b9c6]">
          Altitude <span className="ml-1 text-[11px] normal-case tracking-normal text-white tabular-nums">14 m</span>
        </p>
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 flex h-[34%] items-center gap-3 bg-black/45 px-3 @sm:gap-5"
      >
        {fields.map((f, i) => (
          <div
            key={f.label}
            className={
              "flex shrink-0 flex-col " +
              (i === 2 ? "hidden @xs:flex " : "") +
              (i === 3 ? "ml-auto items-end text-right" : "")
            }
          >
            <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[#b9b9c6]">{f.label}</span>
            <span className="whitespace-nowrap text-sm font-bold leading-tight text-white tabular-nums">
              {f.value}
              {f.unit ? <span className="ml-1 text-[9px] font-medium text-[#b9b9c6]">{f.unit}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
