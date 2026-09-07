"use client";

import type { ComponentType, ReactNode } from "react";
import { motion } from "motion/react";
import { Footprints, Radio, Smartphone } from "lucide-react";
import { FaTwitch } from "react-icons/fa";
import type { AutoSwitcherThresholds } from "@repo/schemas";
import { SCENE_NAMES } from "./switcher-engine";
import { SignalSlider } from "./signal-slider";
import type { MetricKey, MetricReading, Notice, Sample, SwitcherState } from "./switcher-demo-store";
import type { EdgeTone } from "./flow-edges";

/*
 * The stations of the switcher flow diagram. Presentational: the store wiring
 * lives in switcher-flow. The phone shows what you send, the switcher shows
 * how it is judged, the scenes show where OBS is, Twitch shows what chat gets.
 */

/** The badge wording is the product's own, from auto-switcher-status-card. */
export const STATE_BADGE: Record<SwitcherState, { label: string; className: string }> = {
  startup: { label: "Checking signal", className: "border-amber-400/30 bg-amber-400/10 text-amber-200" },
  live: { label: "Live", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" },
  degraded: { label: "Low quality", className: "border-amber-500/30 bg-amber-500/10 text-amber-200" },
  offline: { label: "Signal lost", className: "border-red-500/30 bg-red-500/10 text-red-200" },
};

function formatValue(reading: MetricReading): string {
  if (reading.value === null) return "no data";
  if (reading.key === "loss") return `${reading.value.toFixed(1)} ${reading.unit}`;
  return `${reading.value.toLocaleString("en-US")} ${reading.unit}`;
}

/** The slider's number, shown the instant it moves rather than on the tick. */
function formatManual(key: MetricKey, value: number, unit: string): string {
  // 0 kbps is not a stat, it is the absence of one.
  if (key === "bitrate" && value <= 0) return "feed silent";
  if (key === "loss") return `${value.toFixed(1)} ${unit}`;
  return `${value.toLocaleString("en-US")} ${unit}`;
}

/**
 * Bitrate is a floor, the other two are ceilings. Printed bare rather than
 * grouped, so it matches the preset table further down the page.
 */
function formatThreshold(reading: MetricReading): string {
  return `${reading.key === "bitrate" ? "min" : "max"} ${reading.threshold} ${reading.unit}`;
}

/** Instant judgement of the slider values, ahead of the once-a-second tick. */
export function signalBreaches(signal: Sample, th: AutoSwitcherThresholds): Record<MetricKey, boolean> {
  return {
    bitrate: signal.kbps > 0 && signal.kbps < th.bitrate_min_kbps,
    rtt: signal.rtt > th.rtt_max_ms,
    loss: signal.drop > th.loss_max_pct,
  };
}

/**
 * Which streak this metric is currently counting, and how far along it is.
 * Falling counts bad seconds toward a switch, returning counts good seconds
 * toward the live scene, and offline counts nothing: the streaks were thrown
 * away when the feed went quiet.
 */
function streakFor(reading: MetricReading, state: SwitcherState) {
  if (state === "offline") return null;
  const gate = state === "startup" ? reading.startup : state === "live" ? reading.trigger : reading.recover;
  if (reading.bad > 0) {
    const limit = state === "startup" ? reading.startup : reading.trigger;
    return { tone: "bad" as const, count: Math.min(reading.bad, limit), limit, label: "bad" };
  }
  if (state === "live") return { tone: "ok" as const, count: gate, limit: gate, label: "good" };
  return { tone: "good" as const, count: Math.min(reading.good, gate), limit: gate, label: "good" };
}

const TONE_BAR = {
  bad: "bg-red-400",
  good: "bg-emerald-400",
  ok: "bg-emerald-400/25",
} as const;

function NodeShell({
  icon: Icon,
  title,
  className = "",
  children,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-white/[0.08] bg-white/[0.03] ${className}`}>
      <div className="flex items-center gap-1.5">
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-purple-300" aria-hidden="true" /> : null}
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{title}</p>
      </div>
      {children}
    </div>
  );
}

const SIGNAL_VALUE: Record<MetricKey, (signal: Sample) => number> = {
  bitrate: (signal) => signal.kbps,
  rtt: (signal) => signal.rtt,
  loss: (signal) => signal.drop,
};


export function PhoneNode({
  mode,
  signal,
  metrics,
  thresholds,
  onGrab,
  onChange,
  onWalk,
}: {
  mode: "walk" | "manual";
  signal: Sample;
  metrics: MetricReading[];
  thresholds: AutoSwitcherThresholds;
  onGrab: () => void;
  onChange: (key: MetricKey, value: number) => void;
  onWalk: () => void;
}) {
  const breaches = signalBreaches(signal, thresholds);

  return (
    <NodeShell icon={Smartphone} title="Your phone or encoder" className="p-4">
      {/* Fixed-height slot so switching modes never moves the sliders. */}
      <div className="mt-1.5 flex h-7 items-center">
        {mode === "walk" ? (
          <p className="text-[11px] text-muted-foreground">The signal you send</p>
        ) : (
          <button
            type="button"
            onClick={onWalk}
            className="flex items-center gap-1.5 rounded-md border border-purple-400/40 bg-purple-400/10 px-2.5 py-1 text-[11px] font-medium text-purple-100 transition-colors hover:border-purple-400/60 hover:bg-purple-400/15"
          >
            <Footprints className="h-3 w-3" aria-hidden="true" />
            Take a walk
          </button>
        )}
      </div>
      <div className="mt-3 space-y-3">
        {metrics.map((reading) => {
          const value = SIGNAL_VALUE[reading.key](signal);
          const silentBitrate = reading.key === "bitrate" && value <= 0;
          const tone =
            mode === "manual"
              ? silentBitrate
                ? "text-muted-foreground"
                : breaches[reading.key]
                  ? "text-red-300"
                  : "text-foreground"
              : reading.value === null
                ? "text-muted-foreground"
                : reading.ok
                  ? "text-foreground"
                  : "text-red-300";

          return (
            <div key={reading.key}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-xs font-medium text-foreground">{reading.label}</p>
                <p className={`font-mono text-xs tabular-nums ${tone}`}>
                  {mode === "manual" ? formatManual(reading.key, value, reading.unit) : formatValue(reading)}
                </p>
              </div>
              <div className="mt-1.5">
                <SignalSlider
                  metricKey={reading.key}
                  value={value}
                  threshold={reading.threshold}
                  mode={mode}
                  onGrab={onGrab}
                  onChange={(next) => onChange(reading.key, next)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </NodeShell>
  );
}

export function IngestNode({ silent, offlineAfter }: { silent: number; offlineAfter: number }) {
  return (
    <NodeShell icon={Radio} title="Ingest" className="p-3">
      {silent > 0 ? (
        <p className="mt-1 font-mono text-[10px] tabular-nums text-red-300">
          Quiet {Math.min(silent, offlineAfter)}s of {offlineAfter}s
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">Stats once a second</p>
      )}
    </NodeShell>
  );
}

/** Short row labels; the phone node already spells the metrics out in full. */
const STREAK_LABELS: Record<MetricKey, string> = { bitrate: "Bitrate", rtt: "Ping", loss: "Loss" };

export function SwitcherNode({
  state,
  warning,
  metrics,
}: {
  state: SwitcherState;
  warning: boolean;
  metrics: MetricReading[];
}) {
  const badge = STATE_BADGE[state];

  return (
    <NodeShell title="Auto switcher" className="p-4">
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
          {badge.label}
        </span>
        {warning ? (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200">
            Warning source on
          </span>
        ) : null}
      </div>
      <div className="mt-3 space-y-2">
        {metrics.map((reading) => {
          const streak = streakFor(reading, state);
          const ratio = streak ? streak.count / streak.limit : 0;
          return (
            <div key={reading.key} className="flex items-center gap-2">
              <p className="w-11 shrink-0 text-[10px] text-muted-foreground">{STREAK_LABELS[reading.key]}</p>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ease-out ${streak ? TONE_BAR[streak.tone] : "bg-white/10"}`}
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
              </div>
              <p className="w-20 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                {streak && streak.tone !== "ok" ? `${streak.count}/${streak.limit}s ${streak.label}` : formatThreshold(reading)}
              </p>
            </div>
          );
        })}
      </div>
    </NodeShell>
  );
}

const ACTIVE_CARD: Record<EdgeTone, string> = {
  emerald: "border-emerald-400/40 bg-emerald-400/[0.06]",
  amber: "border-amber-400/40 bg-amber-400/[0.06]",
  red: "border-red-500/40 bg-red-500/[0.06]",
  purple: "border-purple-400/40 bg-purple-400/[0.06]",
};

export type SceneRole = "live" | "offline";

const SCENE_HINT: Record<SceneRole, string> = {
  live: "clean feed",
  offline: "hold screen",
};

function SceneSwatch({ role }: { role: SceneRole }) {
  if (role === "live") {
    return <span aria-hidden="true" className="h-6 w-6 shrink-0 rounded bg-[linear-gradient(160deg,#1b2440_0%,#2a1c3d_55%,#12161f_100%)]" />;
  }
  return (
    <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#0a0a10]">
      <span className="h-1 w-1 rounded-full bg-white/25" />
    </span>
  );
}

export function SceneNode({ role, active, tone }: { role: SceneRole; active: boolean; tone: EdgeTone }) {
  return (
    <div
      className={`flex items-center gap-2.5 overflow-hidden rounded-xl border p-3 transition-[opacity,border-color,background-color] duration-500 lg:h-[4.5rem] ${
        active ? ACTIVE_CARD[tone] : "border-white/[0.08] bg-white/[0.03] opacity-50"
      }`}
    >
      <SceneSwatch role={role} />
      <div className="min-w-0">
        <p className="truncate font-mono text-[11px] text-foreground">{SCENE_NAMES[role]}</p>
        <p className="truncate text-[10px] text-muted-foreground">{SCENE_HINT[role]}</p>
      </div>
    </div>
  );
}

const NOTICE_PILL: Record<Notice["kind"], string> = {
  degraded: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  offline: "border-red-500/30 bg-red-500/10 text-red-100",
  recovered: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
};

export function TwitchNode({ notice }: { notice: Notice | null }) {
  return (
    <NodeShell icon={FaTwitch} title="Twitch" className="p-3">
      <p className="mt-1 text-[11px] text-muted-foreground">What chat sees</p>
      {/* Fixed-height slot so a notice popping in never reflows the diagram. */}
      <div className="mt-2 flex h-9 items-start">
        {notice ? (
          <motion.p
            key={notice.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className={`max-w-full truncate rounded-full border px-2.5 py-1 text-[10px] ${NOTICE_PILL[notice.kind]}`}
          >
            {notice.text}
          </motion.p>
        ) : null}
      </div>
    </NodeShell>
  );
}
