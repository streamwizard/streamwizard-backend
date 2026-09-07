"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AUTO_SWITCHER_PRESET_THRESHOLDS, type AutoSwitcherSensitivityPreset, type AutoSwitcherThresholds } from "@repo/schemas";
import { useDemoTracking } from "../analytics/use-demo-tracking";
import {
  METRIC_KEYS,
  METRIC_LABELS,
  SCENE_NAMES,
  TICK_MS,
  initialEngine,
  step,
  type Engine,
  type MetricKey,
  type MetricReading,
  type Notice,
  type NoticeKind,
  type Phase,
  type Sample,
  type SwitcherState,
} from "./switcher-engine";

export type { MetricKey, MetricReading, Notice, NoticeKind, Phase, Sample, SwitcherState };

/*
 * One simulated walk, shared by three sections: the demo frame watches it, the
 * preset table's chips retune it, and the chat notices show the messages it
 * produced. Sharing one provider is what makes the numbers the same number
 * everywhere on the page. The rules it runs on are in switcher-engine.
 *
 * Grabbing a signal slider takes the walk over: the engine keeps judging once a
 * second, but the sample comes from the visitor until "Walk it again".
 */

/** Where the sliders land before anyone touches them: the cruise baseline. */
const SIGNAL_DEFAULTS: Sample = { kbps: 4500, rtt: 45, drop: 0.2 };

const SIGNAL_FIELD: Record<MetricKey, keyof Sample> = { bitrate: "kbps", rtt: "rtt", loss: "drop" };

/** The schema's bounds per field, so the demo cannot hold an unshippable value. */
const THRESHOLD_LIMITS: Record<keyof AutoSwitcherThresholds, readonly [number, number]> = {
  bitrate_min_kbps: [0, 20000],
  rtt_max_ms: [0, 10000],
  loss_max_pct: [0, 100],
  bitrate_trigger_polls: [1, 120],
  rtt_trigger_polls: [1, 120],
  loss_trigger_polls: [1, 120],
  bitrate_recover_polls: [1, 300],
  rtt_recover_polls: [1, 300],
  loss_recover_polls: [1, 300],
  bitrate_startup_polls: [1, 120],
  rtt_startup_polls: [1, 120],
  loss_startup_polls: [1, 120],
  offline_timeout_seconds: [2, 60],
};

function clampThreshold(key: keyof AutoSwitcherThresholds, value: number): number {
  const [min, max] = THRESHOLD_LIMITS[key];
  const clamped = Math.min(max, Math.max(min, value));
  // Loss is the one fractional field; everything else is whole seconds or units.
  return key === "loss_max_pct" ? Number(clamped.toFixed(1)) : Math.round(clamped);
}

interface SwitcherDemo {
  preset: AutoSwitcherSensitivityPreset;
  setPreset: (preset: AutoSwitcherSensitivityPreset) => void;
  thresholds: AutoSwitcherThresholds;
  state: SwitcherState;
  scene: string;
  metrics: MetricReading[];
  warning: boolean;
  /** Seconds of silence counted so far, against offline_timeout_seconds. */
  silent: number;
  /** Seconds the engine has been in its current state. */
  stateSeconds: number;
  notices: Notice[];
  elapsed: number;
  running: boolean;
  restart: () => void;
  /** Elements that keep the walk ticking while they are on screen. */
  setVisible: (node: Element, visible: boolean) => void;
  /** Whether the scripted walk or the visitor is feeding the engine. */
  mode: "walk" | "manual";
  /** Which stretch of the scripted walk the engine is in. Frozen while manual. */
  phase: Phase;
  /** What the sliders show: instant while dragging, the walk's numbers otherwise. */
  signal: Sample;
  /** First grab of any slider: takes over from wherever the walk was. */
  grabSignal: () => void;
  setSignal: (key: MetricKey, value: number) => void;
  /** Advanced mode: the thresholds are custom instead of a preset's. */
  advanced: boolean;
  /** On seeds the custom set from whatever is running; off returns to the preset. */
  setAdvanced: (on: boolean) => void;
  setThreshold: (key: keyof AutoSwitcherThresholds, value: number) => void;
}

const SwitcherDemoContext = createContext<SwitcherDemo | null>(null);

export function useSwitcherDemo(): SwitcherDemo {
  const value = useContext(SwitcherDemoContext);
  if (!value) throw new Error("useSwitcherDemo must be used inside <SwitcherDemoProvider>");
  return value;
}

/**
 * Keeps the walk running while the element is on screen. Every surface that
 * reads the demo registers, so scrolling from the frame down to the chat feed
 * does not pause the engine mid-outage.
 */
export function useSwitcherViewport<T extends HTMLElement>() {
  const { setVisible } = useSwitcherDemo();
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setVisible(entry.target, entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      setVisible(node, false);
    };
  }, [setVisible]);

  return ref;
}

export function SwitcherDemoProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<AutoSwitcherSensitivityPreset>("balanced");
  const [engine, setEngine] = useState<Engine>(initialEngine);
  const [running, setRunning] = useState(false);
  const [manual, setManual] = useState<Sample | null>(null);
  const [custom, setCustom] = useState<AutoSwitcherThresholds | null>(null);

  const thresholds = custom ?? AUTO_SWITCHER_PRESET_THRESHOLDS[preset];

  const track = useDemoTracking("auto_switcher");
  const visibleRef = useRef(new Set<Element>());
  // The tick reads manual and thresholds through refs so a 60 fps drag or a
  // field edit cannot reset the 1 s interval, and so the very next tick judges
  // the values just set.
  const manualRef = useRef<Sample | null>(null);
  const thresholdsRef = useRef(thresholds);
  const engineRef = useRef(engine);

  useEffect(() => {
    thresholdsRef.current = thresholds;
  }, [thresholds]);

  useEffect(() => {
    engineRef.current = engine;
  }, [engine]);

  const setVisible = useCallback((node: Element, visible: boolean) => {
    const seen = visibleRef.current;
    if (visible) seen.add(node);
    else seen.delete(node);
    setRunning(seen.size > 0);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setEngine((prev) => step(prev, thresholdsRef.current, manualRef.current)), TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  // "Walk it again" is also the way back from manual mode to the scripted walk.
  const restart = useCallback(() => {
    track("replay");
    manualRef.current = null;
    setManual(null);
    setEngine(initialEngine());
  }, [track]);

  const applySignal = useCallback((next: Sample) => {
    manualRef.current = next;
    setManual(next);
  }, []);

  const grabSignal = useCallback(() => {
    track("manual_signal");
    if (manualRef.current) return;
    // Take over from wherever the walk was, so nothing jumps at the handoff.
    const seed = engineRef.current.sample ?? engineRef.current.lastSample ?? SIGNAL_DEFAULTS;
    applySignal({ ...seed });
  }, [track, applySignal]);

  const setSignal = useCallback(
    (key: MetricKey, value: number) => {
      track("manual_signal");
      const base = manualRef.current ?? engineRef.current.sample ?? engineRef.current.lastSample ?? SIGNAL_DEFAULTS;
      // One decimal for loss, whole numbers elsewhere: what the notices print.
      const rounded = key === "loss" ? Number(value.toFixed(1)) : Math.round(value);
      applySignal({ ...base, [SIGNAL_FIELD[key]]: rounded });
    },
    [track, applySignal],
  );

  // In walk mode a new preset restarts the walk: the point of the chips is
  // watching the same bridge switch sooner or later, and that only reads if it
  // starts over. In manual mode the visitor's values stay put; judge() reads
  // the new thresholds on the next tick, so streaks correct within a second.
  // Picking a preset always leaves advanced mode.
  const setPreset = useCallback(
    (next: AutoSwitcherSensitivityPreset) => {
      track(`preset_${next}`);
      setPresetState(next);
      setCustom(null);
      if (!manualRef.current) setEngine(initialEngine());
    },
    [track],
  );

  // Seeded from whatever is running, so turning it on changes nothing by
  // itself. Editing a field never restarts the engine: tuning while the walk
  // or the sliders run is the point.
  const setAdvanced = useCallback(
    (on: boolean) => {
      if (!on) {
        setCustom(null);
        return;
      }
      track("advanced");
      setCustom((prev) => prev ?? { ...thresholdsRef.current });
    },
    [track],
  );

  const setThreshold = useCallback(
    (key: keyof AutoSwitcherThresholds, value: number) => {
      if (!Number.isFinite(value)) return;
      track("advanced_edit");
      setCustom((prev) => ({ ...(prev ?? thresholdsRef.current), [key]: clampThreshold(key, value) }));
    },
    [track],
  );

  const metrics = useMemo<MetricReading[]>(() => {
    const value = (key: MetricKey) => {
      if (!engine.sample) return null;
      if (key === "bitrate") return engine.sample.kbps;
      if (key === "rtt") return engine.sample.rtt;
      return engine.sample.drop;
    };
    const threshold = (key: MetricKey) => {
      if (key === "bitrate") return thresholds.bitrate_min_kbps;
      if (key === "rtt") return thresholds.rtt_max_ms;
      return thresholds.loss_max_pct;
    };
    return METRIC_KEYS.map((key) => ({
      key,
      ...METRIC_LABELS[key],
      value: value(key),
      threshold: threshold(key),
      ok: engine.bad[key] === 0,
      bad: engine.bad[key],
      trigger: thresholds[`${key}_trigger_polls`],
      good: engine.good[key],
      recover: thresholds[`${key}_recover_polls`],
      startup: thresholds[`${key}_startup_polls`],
    }));
  }, [engine, thresholds]);

  const scene = engine.state === "live" ? SCENE_NAMES.live : SCENE_NAMES.offline;

  const value = useMemo<SwitcherDemo>(
    () => ({
      preset,
      setPreset,
      thresholds,
      state: engine.state,
      scene,
      metrics,
      warning: engine.warning,
      silent: engine.silent,
      stateSeconds: engine.stateT,
      notices: engine.notices,
      elapsed: engine.t,
      running,
      restart,
      setVisible,
      mode: manual ? ("manual" as const) : ("walk" as const),
      phase: engine.phase,
      signal: manual ?? engine.sample ?? engine.lastSample ?? SIGNAL_DEFAULTS,
      grabSignal,
      setSignal,
      advanced: custom !== null,
      setAdvanced,
      setThreshold,
    }),
    [
      preset,
      setPreset,
      thresholds,
      engine,
      scene,
      metrics,
      running,
      restart,
      setVisible,
      manual,
      grabSignal,
      setSignal,
      custom,
      setAdvanced,
      setThreshold,
    ],
  );

  return <SwitcherDemoContext.Provider value={value}>{children}</SwitcherDemoContext.Provider>;
}
