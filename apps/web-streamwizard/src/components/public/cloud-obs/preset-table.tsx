"use client";

import {
  AUTO_SWITCHER_PRESET_THRESHOLDS,
  AUTO_SWITCHER_SENSITIVITY_PRESETS,
  PRESET_COPY,
  type AutoSwitcherSensitivityPreset,
  type AutoSwitcherThresholds,
} from "@repo/schemas";
import { useSwitcherDemo, useSwitcherViewport } from "./switcher-demo-store";

/*
 * The preset numbers, read straight out of @repo/schemas so the page cannot
 * publish a threshold the product does not ship. The column headers are
 * buttons: picking one here retunes the demo above, which is the point of
 * printing the numbers at all.
 *
 * Every preset sets one trigger, one recover and one startup streak across all
 * three metrics, so the rows below read the bitrate field and are true for the
 * other two. Only advanced mode lets them diverge.
 */

const ROWS: { label: string; value: (th: AutoSwitcherThresholds) => string }[] = [
  { label: "Bitrate floor", value: (th) => `${th.bitrate_min_kbps} kbps` },
  { label: "Ping ceiling", value: (th) => `${th.rtt_max_ms} ms` },
  { label: "Dropped packets", value: (th) => `${th.loss_max_pct}%` },
  { label: "Switch after", value: (th) => `${th.bitrate_trigger_polls}s bad` },
  { label: "Back after", value: (th) => `${th.bitrate_recover_polls}s good` },
  { label: "Startup check", value: (th) => `${th.bitrate_startup_polls}s` },
  { label: "Offline after", value: (th) => `${th.offline_timeout_seconds}s quiet` },
];

export function PresetTable() {
  const { preset, setPreset, advanced } = useSwitcherDemo();
  const ref = useSwitcherViewport<HTMLDivElement>();

  return (
    <div ref={ref}>
      <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.03]">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">
            Auto switcher sensitivity presets and the thresholds each one sets. Choose a preset to retune the demo.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="px-5 py-4 text-left font-normal text-muted-foreground">
                <span className="font-mono text-[10px] tracking-widest uppercase">Threshold</span>
              </th>
              {AUTO_SWITCHER_SENSITIVITY_PRESETS.map((option: AutoSwitcherSensitivityPreset) => {
                const active = !advanced && option === preset;
                return (
                  <th key={option} scope="col" className="px-3 py-3 text-left align-bottom sm:px-5">
                    <button
                      type="button"
                      onClick={() => setPreset(option)}
                      aria-pressed={active}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                        active
                          ? "border-purple-400/50 bg-purple-400/10 text-purple-100"
                          : "border-transparent text-muted-foreground hover:border-white/[0.12] hover:text-foreground"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{PRESET_COPY[option].title}</span>
                      <span className="mt-0.5 block text-[10px] font-normal tracking-wide">
                        {active ? "Running below" : "Try it"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-t border-white/[0.06]">
                <th scope="row" className="px-5 py-3 text-left text-sm font-normal text-muted-foreground">
                  {row.label}
                </th>
                {AUTO_SWITCHER_SENSITIVITY_PRESETS.map((option: AutoSwitcherSensitivityPreset) => (
                  <td
                    key={option}
                    className={`px-3 py-3 font-mono text-xs tabular-nums sm:px-5 ${
                      !advanced && option === preset ? "bg-purple-400/[0.06] text-purple-100" : "text-foreground/80"
                    }`}
                  >
                    {row.value(AUTO_SWITCHER_PRESET_THRESHOLDS[option])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {advanced ? "The demo above is running your own numbers now. Pick a preset to hand it back." : PRESET_COPY[preset].blurb}
      </p>
    </div>
  );
}

