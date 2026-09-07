import {
  AUTO_SWITCHER_CHAT_TEMPLATE_DEFAULTS,
  type AutoSwitcherThresholds,
} from "@repo/schemas";

/*
 * The walk the cloud OBS page simulates, and the rules it is judged by. Pure
 * on purpose: no React in here, so the state machine can be read (and tested)
 * without a browser. switcher-demo-store wraps it in a provider.
 *
 * This is a deliberately small port of apps/obs-auto-switcher/src/engine: a bad
 * and a good streak per metric, fallback when ANY metric has been bad for its
 * trigger streak, recovery only when ALL three have been good for their recover
 * streak, a feed that went silent re-passing the startup gate rather than the
 * recovery one, and the warning source going on at 2 bad seconds and off at 5
 * good. What it leaves out is the plumbing (session selection, obs-websocket,
 * chat rate limiting), not the judgement.
 *
 * The thresholds and the notice templates come from @repo/schemas rather than
 * being retyped, so the page cannot show a number the product does not ship.
 *
 * Manual mode (the sliders) swaps only the sample source: the visitor's numbers
 * go through the exact judgement the walk does. They carry no wobble, because
 * jitter at the exact threshold a visitor is exploring would reset streaks at
 * random, and a bitrate dragged to 0 means the feed went silent.
 */

export const TICK_MS = 1000;

export type MetricKey = "bitrate" | "rtt" | "loss";
export type SwitcherState = "startup" | "live" | "degraded" | "offline";
export type NoticeKind = "degraded" | "offline" | "recovered";

/** One second of ingest stats, or null for a second where nothing arrived. */
export interface Sample {
  kbps: number;
  rtt: number;
  drop: number;
}

/*
 * Which stretch of the walk we are in. The engine's state decides when to move
 * on, so the walk adapts to whichever preset is running instead of being a
 * fixed timeline.
 *
 * Two kinds of bad stretch, alternating: a `dip` that clears on its own, which
 * is what most bad spots actually are and the only way to see the recover
 * streak do its job, and a `bridge` that goes all the way to silence.
 */
export type Phase = "cruise" | "dip" | "bridge" | "blackout" | "clearing";

export interface Notice {
  id: number;
  kind: NoticeKind;
  text: string;
  /** Seconds into the walk, so the feed reads as a timeline. */
  at: number;
}

export interface MetricReading {
  key: MetricKey;
  label: string;
  /** What the threshold does to this metric, in the product's own words. */
  rule: string;
  unit: string;
  value: number | null;
  threshold: number;
  ok: boolean;
  /** Consecutive bad seconds, and how many it takes to switch. */
  bad: number;
  trigger: number;
  /** Consecutive good seconds, and how many it takes to come back. */
  good: number;
  recover: number;
  startup: number;
}

export interface Engine {
  t: number;
  phase: Phase;
  phaseT: number;
  state: SwitcherState;
  stateT: number;
  sample: Sample | null;
  /** The last second that carried numbers, for notices sent during silence. */
  lastSample: Sample | null;
  bad: Record<MetricKey, number>;
  good: Record<MetricKey, number>;
  silent: number;
  /** The warning source: on after 2 bad seconds, off after 5 good ones. */
  warning: boolean;
  /** Chat is owed an all-clear only once it has heard about a problem. */
  owed: boolean;
  notices: Notice[];
  nextNoticeId: number;
  /** Counts completed laps, so the walk alternates dip and blackout. */
  cycle: number;
}

/** Matches WARNING_SHOW_BAD_POLLS / WARNING_HIDE_GOOD_POLLS in the engine. */
const WARNING_SHOW_BAD = 2;
const WARNING_HIDE_GOOD = 5;

export const METRIC_LABELS: Record<MetricKey, { label: string; rule: string; unit: string }> = {
  bitrate: { label: "Bitrate", rule: "Drops below", unit: "kbps" },
  rtt: { label: "Ping (RTT)", rule: "Climbs above", unit: "ms" },
  loss: { label: "Dropped packets", rule: "Climbs above", unit: "%" },
};

/** The notice templates a fresh config ships with, straight from the schema. */
const NOTICE_TEMPLATES = AUTO_SWITCHER_CHAT_TEMPLATE_DEFAULTS;

/*
 * The two-scene model: Live plus Connection Lost. A rough link and a dead one
 * land on the same holding scene, exactly what the product does when no
 * separate low-bitrate scene is set.
 */
export const SCENE_NAMES = {
  live: "IRL",
  offline: "Connection Lost",
} as const;

/*
 * Deterministic jitter. The numbers have to wobble or the panel reads as a
 * screenshot, but Math.random would paint a different first frame on the server
 * than in the browser, and would diverge again under StrictMode's double
 * invoke. Seeded off the tick, it is the same walk every time.
 */
function wobble(seed: number, spread: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * spread;
}

/** What the phone is delivering this second. Null is silence: nothing arrived. */
function nextSample(phase: Phase, t: number): Sample | null {
  if (phase === "blackout") return null;
  if (phase === "dip") {
    // Under the trees for a moment: the bitrate floor goes, the rest wobbles.
    // Bad for every preset, so the dip always triggers and never hangs.
    return {
      kbps: Math.round(140 + wobble(t, 140)),
      rtt: Math.round(700 + wobble(t + 5, 600)),
      drop: Number((1.1 + wobble(t + 17, 1.7)).toFixed(1)),
    };
  }
  if (phase === "bridge") {
    return {
      kbps: Math.round(90 + wobble(t, 180)),
      rtt: Math.round(1500 + wobble(t + 7, 900)),
      drop: Number((2.4 + wobble(t + 13, 3.4)).toFixed(1)),
    };
  }
  // Cruising and clearing both look like a healthy cellular link on the move.
  return {
    kbps: Math.round(4400 + wobble(t, 2400)),
    rtt: Math.round(45 + wobble(t + 3, 140)),
    drop: Number(wobble(t + 11, 0.2).toFixed(1)),
  };
}

export function initialEngine(): Engine {
  return {
    t: 0,
    phase: "cruise",
    phaseT: 0,
    // A fresh stream is checked before it is allowed on the live scene.
    state: "startup",
    stateT: 0,
    sample: null,
    lastSample: null,
    bad: { bitrate: 0, rtt: 0, loss: 0 },
    good: { bitrate: 0, rtt: 0, loss: 0 },
    silent: 0,
    warning: false,
    owed: false,
    notices: [],
    nextNoticeId: 0,
    cycle: 0,
  };
}

/**
 * Fill a notice template the way the engine does: `{bitrate}` and `{rtt}`
 * rounded, `{loss}` to one decimal from the dropped-packet number the switcher
 * actually judged, `{scene}` the scene it moved to. A value it never received
 * renders as `?`.
 */
function render(template: string, sample: Sample | null, scene: string): string {
  return template
    .replaceAll("{bitrate}", sample ? String(Math.round(sample.kbps)) : "?")
    .replaceAll("{rtt}", sample ? String(Math.round(sample.rtt)) : "?")
    .replaceAll("{loss}", sample ? sample.drop.toFixed(1) : "?")
    .replaceAll("{scene}", scene);
}

export const METRIC_KEYS: MetricKey[] = ["bitrate", "rtt", "loss"];

function judge(sample: Sample, th: AutoSwitcherThresholds): Record<MetricKey, boolean> {
  return {
    bitrate: sample.kbps >= th.bitrate_min_kbps,
    rtt: sample.rtt <= th.rtt_max_ms,
    // drop_pct, not raw loss: the damage a viewer sees, not what SRT repaired.
    loss: sample.drop <= th.loss_max_pct,
  };
}

/** Any metric bad for at least `polls` in a row. */
function anyBadFor(bad: Record<MetricKey, number>, polls: number): boolean {
  return METRIC_KEYS.some((key) => bad[key] >= polls);
}

function anyBadForGate(bad: Record<MetricKey, number>, gate: "trigger" | "startup", th: AutoSwitcherThresholds) {
  return METRIC_KEYS.some((key) => bad[key] >= th[`${key}_${gate}_polls`]);
}

function allGoodForGate(good: Record<MetricKey, number>, gate: "recover" | "startup", th: AutoSwitcherThresholds) {
  return METRIC_KEYS.every((key) => good[key] >= th[`${key}_${gate}_polls`]);
}

/** Every metric good for at least `polls` in a row. */
function allGoodFor(good: Record<MetricKey, number>, polls: number): boolean {
  return METRIC_KEYS.every((key) => good[key] >= polls);
}

const ZERO: Record<MetricKey, number> = { bitrate: 0, rtt: 0, loss: 0 };

/** How long the walk holds a state before moving to the next stretch. */
const PHASE_HOLD = { cruise: 8, dip: 4, bridge: 3, blackout: 3, clearing: 4 } as const;
/** Nothing should sit in one stretch this long. A backstop, not a schedule. */
const PHASE_CEILING = 90;

function nextPhase(phase: Phase, phaseT: number, state: SwitcherState, stateT: number, cycle: number): Phase {
  const stuck = phaseT >= PHASE_CEILING;
  if (phase === "cruise") {
    if (phaseT < PHASE_HOLD.cruise) return "cruise";
    // Alternate: a dip that recovers, then one that goes dark.
    return cycle % 2 === 0 ? "dip" : "bridge";
  }
  if (phase === "dip") {
    return (state === "degraded" && stateT >= PHASE_HOLD.dip) || stuck ? "clearing" : "dip";
  }
  if (phase === "bridge") {
    return (state === "degraded" && stateT >= PHASE_HOLD.bridge) || stuck ? "blackout" : "bridge";
  }
  if (phase === "blackout") {
    return (state === "offline" && stateT >= PHASE_HOLD.blackout) || stuck ? "clearing" : "blackout";
  }
  return (state === "live" && stateT >= PHASE_HOLD.clearing) || stuck ? "cruise" : "clearing";
}

export function step(prev: Engine, th: AutoSwitcherThresholds, manual?: Sample | null): Engine {
  const t = prev.t + 1;
  const sample = manual == null ? nextSample(prev.phase, t) : manual.kbps <= 0 ? null : manual;

  let bad = { ...prev.bad };
  let good = { ...prev.good };
  let silent = prev.silent;
  let state = prev.state;
  let warning = prev.warning;
  let notice: NoticeKind | null = null;

  if (!sample) {
    silent += 1;
    if (silent >= th.offline_timeout_seconds && state !== "offline") {
      // Stats stopped arriving for long enough to call it: cut to the
      // connection-lost scene and throw the counts away.
      state = "offline";
      bad = { ...ZERO };
      good = { ...ZERO };
      warning = false;
      notice = "offline";
    }
  } else {
    silent = 0;
    if (state === "offline") {
      // A silent-then-resumed feed re-passes the startup gate, exactly like a
      // brand new stream.
      state = "startup";
      bad = { ...ZERO };
      good = { ...ZERO };
    }

    const ok = judge(sample, th);
    for (const key of METRIC_KEYS) {
      if (ok[key]) {
        good[key] += 1;
        bad[key] = 0;
      } else {
        bad[key] += 1;
        good[key] = 0;
      }
    }

    if (state === "startup") {
      if (anyBadForGate(bad, "startup", th)) {
        state = "degraded";
        warning = false;
        notice = "degraded";
      } else if (allGoodForGate(good, "startup", th)) {
        state = "live";
        warning = false;
        notice = "recovered";
      }
    } else if (state === "live") {
      if (anyBadForGate(bad, "trigger", th)) {
        state = "degraded";
        warning = false;
        notice = "degraded";
      } else if (warning) {
        if (allGoodFor(good, WARNING_HIDE_GOOD)) warning = false;
      } else if (anyBadFor(bad, WARNING_SHOW_BAD)) {
        warning = true;
      }
    } else if (allGoodForGate(good, "recover", th)) {
      state = "live";
      warning = false;
      notice = "recovered";
    }
  }

  const changed = state !== prev.state;
  const stateT = changed ? 0 : prev.stateT + 1;

  const lastSample = sample ?? prev.lastSample;
  let notices = prev.notices;
  let nextNoticeId = prev.nextNoticeId;
  let owed = prev.owed;

  // Chat only hears "back live" if it heard about a problem first.
  if (notice === "recovered" && !owed) notice = null;
  if (notice) {
    const scene = notice === "recovered" ? SCENE_NAMES.live : SCENE_NAMES.offline;
    notices = [
      ...notices,
      { id: nextNoticeId, kind: notice, text: render(NOTICE_TEMPLATES[notice], lastSample, scene), at: t },
    ].slice(-6);
    nextNoticeId += 1;
    owed = notice !== "recovered";
  }

  // The walk freezes where it was while the visitor drives; restart resumes it.
  const phase = manual == null ? nextPhase(prev.phase, prev.phaseT + 1, state, stateT, prev.cycle) : prev.phase;

  return {
    t,
    phase,
    // A lap ends when the walk gets back to cruising, which is what flips the
    // next bad stretch between a dip and a blackout.
    cycle: phase === "cruise" && prev.phase === "clearing" ? prev.cycle + 1 : prev.cycle,
    phaseT: manual != null ? prev.phaseT : phase === prev.phase ? prev.phaseT + 1 : 0,
    state,
    stateT,
    sample,
    lastSample,
    bad,
    good,
    silent,
    warning,
    owed,
    notices,
    nextNoticeId,
  };
}
