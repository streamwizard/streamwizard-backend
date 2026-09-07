import { z } from "zod";
import {
  autoSwitcherConfigSchema,
  type AutoSwitcherSensitivityPreset,
  type AutoSwitcherThresholds,
} from "./auto-switcher";

// The switcher settings form, shared by the streamer dashboard, the phone deck
// and web-admin's per-user editor so the three surfaces can't drift on
// validation, defaults or preset wording.

// Everything the settings form edits — the override fields live on the same
// row but are driven by the override controls, not the form.
export const autoSwitcherFormSchema = autoSwitcherConfigSchema
  .omit({
    user_id: true,
    override_scene_uuid: true,
    override_scene_name: true,
    override_expires_at: true,
  })
  .superRefine((val, ctx) => {
    if (!val.enabled) return;
    if (!val.scene_live_uuid) {
      ctx.addIssue({ code: "custom", path: ["scene_live_uuid"], message: "Pick the scene you stream from." });
    }
    if (!val.scene_offline_uuid) {
      ctx.addIssue({ code: "custom", path: ["scene_offline_uuid"], message: "Pick a scene to show when the signal is gone." });
    }
    if (val.scene_model === "three" && !val.scene_degraded_uuid) {
      ctx.addIssue({ code: "custom", path: ["scene_degraded_uuid"], message: "Pick a scene for when the connection gets rough." });
    }
    if (val.warning_source_enabled && !val.warning_source_uuid && !val.warning_source_name) {
      ctx.addIssue({ code: "custom", path: ["warning_source_uuid"], message: "Pick the source to show as a warning." });
    }
    if (val.mode === "advanced" && !val.advanced_thresholds) {
      ctx.addIssue({ code: "custom", path: ["advanced_thresholds"], message: "Advanced mode needs threshold values." });
    }
  });

export type AutoSwitcherFormValues = z.infer<typeof autoSwitcherFormSchema>;

/**
 * The chat notice templates a fresh config starts with, matching the column
 * defaults in SQL. Exported because the public cloud OBS page shows them as
 * the shipped defaults, and a marketing page quoting a different string than
 * the product hands out is the kind of drift nobody notices for a year.
 */
export const AUTO_SWITCHER_CHAT_TEMPLATE_DEFAULTS = {
  degraded: "Connection unstable — switching to backup scene ({bitrate} kbps, {rtt} ms RTT)",
  offline: "Stream signal lost — hang tight!",
  recovered: "Signal restored — back live!",
} as const;

export const PRESET_COPY: Record<AutoSwitcherSensitivityPreset, { title: string; blurb: string }> = {
  relaxed: { title: "Relaxed", blurb: "Waits ~6s of bad signal before switching, ~15s stable before switching back. Rides out tunnels and dead spots." },
  balanced: { title: "Balanced", blurb: "Switches after ~4s bad, back after ~8s stable. The right pick for most IRL setups." },
  fast: { title: "Fast", blurb: "Switches after ~2s bad, back after ~5s stable. For when a single frozen frame is one too many." },
};

/**
 * The subset of the config row the form reads. Declared structurally so this
 * package stays free of a dependency on the generated Supabase types.
 */
export interface AutoSwitcherConfigRowLike {
  enabled?: boolean | null;
  mode?: string | null;
  scene_model?: string | null;
  scene_live_uuid?: string | null;
  scene_live_name?: string | null;
  scene_degraded_uuid?: string | null;
  scene_degraded_name?: string | null;
  scene_offline_uuid?: string | null;
  scene_offline_name?: string | null;
  sensitivity_preset?: string | null;
  advanced_thresholds?: unknown;
  pinned_stream_key_label?: string | null;
  log_events_enabled?: boolean | null;
  chat_notices_enabled?: boolean | null;
  chat_template_degraded?: string | null;
  chat_template_offline?: string | null;
  chat_template_recovered?: string | null;
  warning_source_enabled?: boolean | null;
  warning_source_uuid?: string | null;
  warning_source_name?: string | null;
  auto_stop_enabled?: boolean | null;
  auto_stop_minutes?: number | null;
}

/** Maps a nullable config row to form defaults, mirroring the column defaults in SQL. */
export function defaultsFrom(row: AutoSwitcherConfigRowLike | null): AutoSwitcherFormValues {
  return {
    enabled: row?.enabled ?? false,
    mode: (row?.mode as "simple" | "advanced") ?? "simple",
    scene_model: (row?.scene_model as "two" | "three") ?? "three",
    scene_live_uuid: row?.scene_live_uuid ?? null,
    scene_live_name: row?.scene_live_name ?? null,
    scene_degraded_uuid: row?.scene_degraded_uuid ?? null,
    scene_degraded_name: row?.scene_degraded_name ?? null,
    scene_offline_uuid: row?.scene_offline_uuid ?? null,
    scene_offline_name: row?.scene_offline_name ?? null,
    sensitivity_preset: (row?.sensitivity_preset as AutoSwitcherSensitivityPreset) ?? "balanced",
    advanced_thresholds: (row?.advanced_thresholds as AutoSwitcherThresholds | null) ?? null,
    pinned_stream_key_label: row?.pinned_stream_key_label ?? null,
    log_events_enabled: row?.log_events_enabled ?? true,
    chat_notices_enabled: row?.chat_notices_enabled ?? false,
    chat_template_degraded: row?.chat_template_degraded ?? AUTO_SWITCHER_CHAT_TEMPLATE_DEFAULTS.degraded,
    chat_template_offline: row?.chat_template_offline ?? AUTO_SWITCHER_CHAT_TEMPLATE_DEFAULTS.offline,
    chat_template_recovered: row?.chat_template_recovered ?? AUTO_SWITCHER_CHAT_TEMPLATE_DEFAULTS.recovered,
    warning_source_enabled: row?.warning_source_enabled ?? false,
    warning_source_uuid: row?.warning_source_uuid ?? null,
    warning_source_name: row?.warning_source_name ?? null,
    auto_stop_enabled: row?.auto_stop_enabled ?? false,
    auto_stop_minutes: row?.auto_stop_minutes ?? 10,
  };
}
