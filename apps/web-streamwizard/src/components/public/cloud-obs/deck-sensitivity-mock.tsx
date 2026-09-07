"use client";

import { PRESET_COPY, type AutoSwitcherSensitivityPreset, type AutoSwitcherStatus } from "@repo/schemas";
import { Badge } from "@repo/ui";
import { ChoiceCards, SettingSection, StepperRow, SwitchRow } from "@/components/deck/setting-row";
import { SwitcherStatusStrip } from "@/components/deck/switcher-status-strip";
import { useSwitcherDemo, useSwitcherViewport } from "./switcher-demo-store";

/*
 * The deck's Sensitivity tab, drawn in a phone frame and wired to the same
 * store as the flow diagram above it: pick a preset or flip advanced mode here
 * and the sim retunes, which is the pitch made tappable. The rows are the
 * deck's own components, so what a visitor taps here is what they get after
 * logging in. The status strip shows the sim's live state, same shape the real
 * engine publishes.
 */

export function DeckSensitivityMock() {
  const { preset, setPreset, advanced, setAdvanced, thresholds, setThreshold, state, metrics, warning, signal } =
    useSwitcherDemo();
  const ref = useSwitcherViewport<HTMLDivElement>();

  const streak = (key: string) => {
    const reading = metrics.find((entry) => entry.key === key);
    return { bad: reading?.bad ?? 0, good: reading?.good ?? 0 };
  };

  const status: AutoSwitcherStatus = {
    state,
    armed: true,
    override: null,
    selected_session: null,
    streaks: { bitrate: streak("bitrate"), rtt: streak("rtt"), loss: streak("loss") },
    thresholds,
    warning_shown: warning,
    latest: { kbps: Math.round(signal.kbps), rtt_ms: Math.round(signal.rtt), loss_pct: signal.drop, at: 0 },
    last_switch: null,
    last_error: null,
    offline_since: null,
    auto_stop_deadline: null,
  };

  return (
    <div
      ref={ref}
      className="w-[300px] shrink-0 rounded-[2rem] border border-white/[0.1] bg-white/[0.03] p-2 shadow-[0_16px_48px_-16px_rgba(158,122,255,0.25)]"
    >
      <div
        role="group"
        aria-label="The deck's Sensitivity tab, wired to the demo above: presets and advanced mode retune it live"
        className="flex flex-col overflow-hidden rounded-[1.5rem] bg-background"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-5 pb-3">
          <h3 className="text-lg font-semibold">Sensitivity</h3>
          <Badge variant="default" className="gap-1.5">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-400 motion-reduce:animate-none" />
            OBS Connected
          </Badge>
        </div>

        <div className="space-y-5 px-4 pb-5">
          <SwitcherStatusStrip status={status} enabled />

          <SettingSection
            title="Sensitivity"
            description="How quickly the auto switcher reacts when your IRL signal gets rough. Changes land while you stream."
          >
            <SwitchRow
              label="Advanced mode"
              description="Tune every threshold yourself instead of using a preset."
              checked={advanced}
              onCheckedChange={setAdvanced}
            />

            {advanced ? (
              <div className="divide-y divide-border">
                <StepperRow
                  label="Drops below"
                  unit="kbps"
                  value={thresholds.bitrate_min_kbps}
                  min={0}
                  max={20_000}
                  step={100}
                  onChange={(next) => setThreshold("bitrate_min_kbps", next)}
                />
                <StepperRow
                  label="Trigger"
                  description="Seconds bad before it switches away"
                  unit="seconds"
                  value={thresholds.bitrate_trigger_polls}
                  min={1}
                  max={120}
                  onChange={(next) => setThreshold("bitrate_trigger_polls", next)}
                />
                <StepperRow
                  label="Recover"
                  description="Seconds good before it switches back"
                  unit="seconds"
                  value={thresholds.bitrate_recover_polls}
                  min={1}
                  max={300}
                  onChange={(next) => setThreshold("bitrate_recover_polls", next)}
                />
              </div>
            ) : (
              <ChoiceCards
                value={preset}
                onChange={setPreset}
                options={(Object.keys(PRESET_COPY) as AutoSwitcherSensitivityPreset[]).map((key) => ({
                  value: key,
                  title: PRESET_COPY[key].title,
                  blurb: PRESET_COPY[key].blurb,
                }))}
              />
            )}
          </SettingSection>
        </div>
      </div>
    </div>
  );
}
