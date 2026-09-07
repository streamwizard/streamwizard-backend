"use client";

import { useState } from "react";
import { MotionConfig, motion } from "motion/react";
import { Footprints, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  PRESET_COPY,
  AUTO_SWITCHER_SENSITIVITY_PRESETS,
  type AutoSwitcherSensitivityPreset,
  type AutoSwitcherThresholds,
} from "@repo/schemas";
import { EdgeLine, FanEdges, MergeEdges, TickDot, type EdgeTone } from "./flow-edges";
import { IngestNode, PhoneNode, SceneNode, SwitcherNode, TwitchNode, signalBreaches } from "./flow-nodes";
import {
  useSwitcherDemo,
  useSwitcherViewport,
  type MetricReading,
  type Phase,
  type SwitcherState,
} from "./switcher-demo-store";

/*
 * The auto switcher as a flow diagram: your phone feeds the ingest, the
 * switcher judges the stats once a second and routes OBS to the live scene or
 * the holding scene, and Twitch shows the result. The wires carry the story: the signal
 * wire changes tone and speed with the sliders, and the active route lights up
 * as the engine switches. The walk it judges lives in switcher-demo-store;
 * grab a slider and the sample source is yours instead.
 */

const FLOW_LABEL =
  "Live diagram of the auto switcher. Your phone feeds the ingest, the switcher judges the stats once a second and routes OBS to the IRL or Connection Lost scene, and Twitch shows the result.";

/** Where the scripted walk is, told as the walk the streamer is on. */
const WALK_STORY: Record<Phase, string> = {
  cruise: "Walking the open street. Signal is good.",
  dip: "Under the trees. The bitrate sags.",
  bridge: "Into the tunnel. The signal is going.",
  blackout: "Deep in the tunnel. Nothing gets out.",
  clearing: "Out the other side. The link rebuilds.",
};

/** The headline over the diagram: the walk's story, or who is driving. */
function WalkBanner({ mode, phase }: { mode: "walk" | "manual"; phase: Phase }) {
  const walking = mode === "walk";
  const Icon = walking ? Footprints : SlidersHorizontal;
  return (
    <div className="mb-5 flex justify-center">
      <motion.p
        key={walking ? phase : "manual"}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-sm text-foreground"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-purple-300" aria-hidden="true" />
        {walking ? WALK_STORY[phase] : "Walk paused. You drive the signal now."}
      </motion.p>
    </div>
  );
}

/** The tone the active route takes: being checked, on air, rough, or gone. */
const STATE_TONE: Record<SwitcherState, EdgeTone> = {
  startup: "amber",
  live: "emerald",
  degraded: "amber",
  offline: "red",
};

/**
 * Which scene card the route runs through: 0 IRL, 1 Connection Lost. The
 * two-scene model sends a rough link and a dead one to the same holding scene;
 * the tone still tells them apart.
 */
function sceneIndexFor(state: SwitcherState): number {
  return state === "live" ? 0 : 1;
}

/** Dash speed follows the bitrate, in tiers wide enough to rarely restart. */
function dashDuration(kbps: number): string {
  if (kbps >= 2500) return "[animation-duration:0.7s]";
  if (kbps >= 800) return "[animation-duration:1.2s]";
  return "[animation-duration:2s]";
}

/**
 * The seconds left on whichever streak is counting toward a switch, shown on
 * the wires where the switch will happen. Mirrors the engine's gates: bad
 * seconds toward the fallback, good seconds back toward live, quiet seconds
 * toward the cutoff.
 */
function countdownFor(
  state: SwitcherState,
  metrics: MetricReading[],
  silent: number,
  offlineAfter: number,
): { label: string; tone: EdgeTone } | null {
  if (state === "offline") return null;
  if (silent > 0) {
    const remaining = Math.max(offlineAfter - silent, 0);
    return remaining > 0 ? { label: `Switching in ${remaining}s`, tone: "red" } : null;
  }
  if (state === "degraded") {
    // Recovery only counts while every metric is good; one bad second resets it.
    if (metrics.some((reading) => reading.bad > 0)) return null;
    const remaining = Math.max(...metrics.map((reading) => reading.recover - reading.good));
    return remaining > 0 ? { label: `Back live in ${remaining}s`, tone: "emerald" } : null;
  }
  const gate = (reading: MetricReading) => (state === "startup" ? reading.startup : reading.trigger);
  const falling = metrics.filter((reading) => reading.bad > 0);
  if (falling.length > 0) {
    const remaining = Math.min(...falling.map((reading) => gate(reading) - reading.bad));
    return remaining > 0 ? { label: `Switching in ${remaining}s`, tone: "amber" } : null;
  }
  if (state === "startup") {
    const remaining = Math.max(...metrics.map((reading) => reading.startup - reading.good));
    return remaining > 0 ? { label: `Live in ${remaining}s`, tone: "amber" } : null;
  }
  return null;
}

const COUNTDOWN_PILL: Record<EdgeTone, string> = {
  emerald: "border-emerald-400/40 bg-emerald-400/15 text-emerald-100",
  amber: "border-amber-400/40 bg-amber-400/15 text-amber-100",
  red: "border-red-500/40 bg-red-500/15 text-red-100",
  purple: "border-purple-400/40 bg-purple-400/15 text-purple-100",
};

/** One line on what the switcher is doing about all this. */
function reasonFor(state: SwitcherState, warning: boolean, silent: number, offlineAfter: number, recover: number) {
  if (state === "startup") return "Checking the feed before it is allowed on the live scene.";
  if (state === "live") {
    return warning
      ? "Warning source showing in the live scene. No switch yet."
      : "Every metric inside its threshold. Nothing to do.";
  }
  if (state === "degraded") return `On the fallback. All three metrics need ${recover}s good to come back.`;
  return `Nothing arriving for ${silent}s, past the ${offlineAfter}s cutoff.`;
}

const CHIP_ACTIVE = "border-purple-400/50 bg-purple-400/15 text-purple-100";
const CHIP_IDLE = "border-white/[0.1] bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-foreground";

function PresetChips({ onAdvancedClick }: { onAdvancedClick: () => void }) {
  const { preset, setPreset, advanced } = useSwitcherDemo();

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Auto switcher sensitivity">
      {AUTO_SWITCHER_SENSITIVITY_PRESETS.map((option: AutoSwitcherSensitivityPreset) => {
        const active = !advanced && option === preset;
        return (
          <button
            key={option}
            type="button"
            onClick={() => setPreset(option)}
            aria-pressed={active}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${active ? CHIP_ACTIVE : CHIP_IDLE}`}
          >
            {PRESET_COPY[option].title}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAdvancedClick}
        aria-pressed={advanced}
        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${advanced ? CHIP_ACTIVE : CHIP_IDLE}`}
      >
        Advanced
      </button>
    </div>
  );
}

const ADV_METRICS = [
  { label: "Bitrate", thresholdKey: "bitrate_min_kbps", pollPrefix: "bitrate", unit: "kbps", step: 50 },
  { label: "Ping (RTT)", thresholdKey: "rtt_max_ms", pollPrefix: "rtt", unit: "ms", step: 10 },
  { label: "Dropped packets", thresholdKey: "loss_max_pct", pollPrefix: "loss", unit: "%", step: 0.1 },
] as const;

const ADV_GATES = [
  { key: "trigger", label: "Switch after", hint: "1 to 120s" },
  { key: "recover", label: "Back after", hint: "1 to 300s" },
] as const;

function ThresholdField({
  label,
  value,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <span className="flex items-center gap-1 rounded-md border border-white/[0.1] bg-black/30 px-2 py-1.5 transition-colors focus-within:border-purple-400/50">
        <input
          type="number"
          value={value}
          step={step}
          onChange={(event) => onChange(event.target.valueAsNumber)}
          className="w-full min-w-0 bg-transparent font-mono text-xs tabular-nums text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{suffix}</span>
      </span>
    </label>
  );
}

/**
 * Advanced mode, editable: the same matrix the presets fill in, but every cell
 * is yours and each metric can hold its own streak. Edits apply on the next
 * tick without restarting anything. Startup and offline gates stay on the
 * seeded preset values; the story here is the switch and the way back.
 */
function AdvancedPanel() {
  const { thresholds, setThreshold } = useSwitcherDemo();

  return (
    <div className="mt-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[24rem] border-collapse">
          <caption className="sr-only">
            Advanced thresholds: floor or ceiling per metric, plus its switch and recover streaks in seconds.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="pb-2 text-left">
                <span className="sr-only">Metric</span>
              </th>
              <th scope="col" className="px-2 pb-2 text-left">
                <span className="block font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  Threshold
                </span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground/70">floor or ceiling</span>
              </th>
              {ADV_GATES.map((gate) => (
                <th key={gate.key} scope="col" className="px-2 pb-2 text-left">
                  <span className="block font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                    {gate.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground/70">{gate.hint}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ADV_METRICS.map((metric) => (
              <tr key={metric.thresholdKey}>
                <th scope="row" className="py-1.5 pr-3 text-left text-xs font-normal whitespace-nowrap text-muted-foreground">
                  {metric.label}
                </th>
                <td className="px-2 py-1.5">
                  <ThresholdField
                    label={`${metric.label} threshold`}
                    value={thresholds[metric.thresholdKey]}
                    step={metric.step}
                    suffix={metric.unit}
                    onChange={(value) => setThreshold(metric.thresholdKey, value)}
                  />
                </td>
                {ADV_GATES.map((gate) => {
                  const key = `${metric.pollPrefix}_${gate.key}_polls` as keyof AutoSwitcherThresholds;
                  return (
                    <td key={gate.key} className="px-2 py-1.5">
                      <ThresholdField
                        label={`${metric.label} ${gate.label.toLowerCase()}`}
                        value={thresholds[key]}
                        step={1}
                        suffix="s"
                        onChange={(value) => setThreshold(key, value)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The phone-to-ingest wire, with the "feed silent" chip when it is cut. */
function SignalEdge({ tone, cut, durationClass }: { tone: EdgeTone; cut: boolean; durationClass: string }) {
  return (
    <div aria-hidden="true" className="relative mx-auto h-8 w-full max-w-40 lg:mx-0 lg:h-10 lg:max-w-none">
      <div className="hidden h-full w-full lg:block">
        <EdgeLine tone={tone} cut={cut} durationClass={durationClass} />
      </div>
      <div className="h-full w-full lg:hidden">
        <EdgeLine vertical tone={tone} cut={cut} durationClass={durationClass} />
      </div>
      {cut ? (
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] tracking-wide whitespace-nowrap text-red-200">
          feed silent
        </span>
      ) : null}
    </div>
  );
}

/** The ingest-to-switcher wire: one stats packet per second while any arrive. */
function TickEdge({ silent, tick, hasSample }: { silent: boolean; tick: number; hasSample: boolean }) {
  return (
    <div aria-hidden="true" className="relative mx-auto h-8 w-full max-w-40 lg:mx-0 lg:h-10 lg:max-w-none">
      <div className="relative hidden h-full w-full lg:block">
        <EdgeLine tone="purple" cut={silent} cutClass="stroke-white/10" />
        {hasSample ? <TickDot key={tick} /> : null}
      </div>
      <div className="relative h-full w-full lg:hidden">
        <EdgeLine vertical tone="purple" cut={silent} cutClass="stroke-white/10" />
        {hasSample ? <TickDot key={tick} vertical /> : null}
      </div>
    </div>
  );
}

export function SwitcherFlow() {
  const {
    state,
    metrics,
    warning,
    silent,
    thresholds,
    restart,
    elapsed,
    mode,
    phase,
    signal,
    grabSignal,
    setSignal,
    notices,
    advanced,
    setAdvanced,
  } = useSwitcherDemo();
  const ref = useSwitcherViewport<HTMLDivElement>();

  // The editable matrix unfolds only from this chip. Turning advanced on from
  // the deck mock further down keeps the card's height still, so the page does
  // not jump under the control being touched.
  const [panelOpen, setPanelOpen] = useState(false);
  const onAdvancedClick = () => {
    if (advanced) {
      setPanelOpen((prev) => !prev);
    } else {
      setAdvanced(true);
      setPanelOpen(true);
    }
  };

  const tone = STATE_TONE[state];
  const activeIndex = sceneIndexFor(state);

  // Judge the sliders instantly for the signal wire; the engine follows within
  // a tick. In walk mode `signal` moves at tick speed anyway.
  const breaches = signalBreaches(signal, thresholds);
  const breachCount = Number(breaches.bitrate) + Number(breaches.rtt) + Number(breaches.loss);
  const signalTone: EdgeTone = breachCount === 0 ? "emerald" : breachCount === 1 ? "amber" : "red";
  const feedCut = mode === "manual" ? signal.kbps <= 0 : silent > 0;
  const hasSample = metrics.some((reading) => reading.value !== null);
  const lastNotice = notices.length > 0 ? notices[notices.length - 1] : null;
  const countdown = countdownFor(state, metrics, silent, thresholds.offline_timeout_seconds);

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={ref}
        role="group"
        aria-label={FLOW_LABEL}
        className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 lg:p-6"
      >
        <WalkBanner mode={mode} phase={phase} />

        <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1.25fr)_2.5rem_auto_2.5rem_minmax(0,1.05fr)_3.5rem_minmax(0,1fr)_3.5rem_auto] lg:items-center">
          <PhoneNode
            mode={mode}
            signal={signal}
            metrics={metrics}
            thresholds={thresholds}
            onGrab={grabSignal}
            onChange={setSignal}
            onWalk={restart}
          />
          <SignalEdge tone={signalTone} cut={feedCut} durationClass={dashDuration(signal.kbps)} />
          <IngestNode silent={silent} offlineAfter={thresholds.offline_timeout_seconds} />
          <TickEdge silent={silent > 0} tick={elapsed} hasSample={hasSample} />
          <SwitcherNode state={state} warning={warning} metrics={metrics} />
          <div className="relative">
            <div aria-hidden="true">
              <FanEdges activeIndex={activeIndex} tone={tone} />
            </div>
            {countdown ? (
              <span
                className={`absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-wide whitespace-nowrap tabular-nums shadow-[0_0_12px_rgba(0,0,0,0.6)] backdrop-blur-sm ${COUNTDOWN_PILL[countdown.tone]}`}
              >
                {countdown.label}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 lg:h-40 lg:grid-cols-1 lg:grid-rows-2 lg:gap-4">
            <SceneNode role="live" active={activeIndex === 0} tone={tone} />
            <SceneNode role="offline" active={activeIndex === 1} tone={tone} />
          </div>
          <div aria-hidden="true">
            <MergeEdges activeIndex={activeIndex} tone={tone} />
          </div>
          <TwitchNode notice={lastNotice} />
        </div>

        <div className="mt-6 border-t border-white/[0.06] pt-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="mb-2 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Sensitivity</p>
              <PresetChips onAdvancedClick={onAdvancedClick} />
            </div>
            <button
              type="button"
              onClick={restart}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/[0.1] px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Walk it again
            </button>
          </div>
          {advanced && panelOpen ? <AdvancedPanel /> : null}
          <p className="mt-3 text-[11px] text-muted-foreground">
            {reasonFor(state, warning, silent, thresholds.offline_timeout_seconds, thresholds.bitrate_recover_polls)}
            {mode === "walk" ? (
              <>
                {" "}
                <span className="tabular-nums">{elapsed}s</span> into the walk.
              </>
            ) : null}
          </p>
        </div>
      </div>
    </MotionConfig>
  );
}
