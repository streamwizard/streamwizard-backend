"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  AUTO_SWITCHER_PRESET_THRESHOLDS,
  type AutoSwitcherSensitivityPreset,
  type AutoSwitcherThresholds,
} from "@repo/schemas";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@repo/ui";
import { ChevronDown } from "lucide-react";
import { upsertAutoSwitcherConfig } from "@/actions/supabase/auto-switcher";
import type { AutoSwitcherConfigRow } from "@repo/supabase/queries/auto-switcher";
import { autoSwitcherFormSchema, type AutoSwitcherFormValues } from "@repo/schemas";
import { PRESET_COPY, defaultsFrom } from "@repo/schemas";
import { useAutoSwitcherStatus } from "@/hooks/obs/use-auto-switcher-status";
import { SwitcherStatusStrip } from "@/components/deck/switcher-status-strip";
import { ChoiceCards, SettingRow, SettingSection, StepperRow, SwitchRow } from "@/components/deck/setting-row";

// Sensitivity-only slice of the dashboard's AutoSwitcherForm. Same schema, same
// server action, same defaults -- every other field round-trips untouched, so
// scenes, chat notices and auto-stop stay a dashboard job.

/** What the deck's sticky save bar needs to know. Primitives only, so the effect that reports it can't loop. */
export interface SaveBarState {
  dirty: boolean;
  submitting: boolean;
  hasErrors: boolean;
}

export interface SaveBarActions {
  save: () => void;
  discard: () => void;
}

interface SwitcherSettingsPanelProps {
  config: AutoSwitcherConfigRow | null;
  canInteract: boolean;
  onSaved: (row: AutoSwitcherConfigRow) => void;
  onSaveBarChange: (state: SaveBarState) => void;
  actionsRef: React.MutableRefObject<SaveBarActions | null>;
}

const THRESHOLD_GROUPS = [
  {
    key: "bitrate",
    label: "Bitrate",
    limit: { field: "bitrate_min_kbps", label: "Drops below", unit: "kbps", min: 0, max: 100_000, step: 100 },
    trigger: "bitrate_trigger_polls",
    recover: "bitrate_recover_polls",
    startup: "bitrate_startup_polls",
  },
  {
    key: "rtt",
    label: "Ping (RTT)",
    limit: { field: "rtt_max_ms", label: "Climbs above", unit: "ms", min: 0, max: 10_000, step: 25 },
    trigger: "rtt_trigger_polls",
    recover: "rtt_recover_polls",
    startup: "rtt_startup_polls",
  },
  {
    key: "loss",
    // Measured against drop_pct (packets SRT gave up on), not raw link loss —
    // hence the sub-1% steps.
    label: "Dropped packets",
    limit: { field: "loss_max_pct", label: "Climbs above", unit: "%", min: 0, max: 100, step: 0.5 },
    trigger: "loss_trigger_polls",
    recover: "loss_recover_polls",
    startup: "loss_startup_polls",
  },
] as const;

export function SwitcherSettingsPanel({
  config,
  canInteract,
  onSaved,
  onSaveBarChange,
  actionsRef,
}: SwitcherSettingsPanelProps) {
  const form = useForm<AutoSwitcherFormValues>({
    resolver: zodResolver(autoSwitcherFormSchema),
    defaultValues: defaultsFrom(config),
  });
  const { status } = useAutoSwitcherStatus();
  const containerRef = useRef<HTMLDivElement>(null);

  const values = form.watch();
  const errors = form.formState.errors;
  const { isDirty, isSubmitting } = form.formState;
  const hasErrors = Object.keys(errors).length > 0;
  // Errors on fields this panel doesn't render (scenes, warning source) can only
  // come from settings made on the dashboard, so say where to go fix them.
  const hasHiddenErrors = Object.keys(errors).some((key) => key !== "advanced_thresholds");

  // Report save-bar state up to the deck shell, which renders the bar above the
  // tab bar. Only primitives in the dep list, so this can't feed back into itself.
  useEffect(() => {
    onSaveBarChange({ dirty: isDirty, submitting: isSubmitting, hasErrors });
  }, [isDirty, isSubmitting, hasErrors, onSaveBarChange]);

  async function submit() {
    await form.handleSubmit(onValid, onInvalid)();
  }

  function onInvalid() {
    // Custom rows aren't focusable inputs, so RHF's shouldFocusError can't land
    // on them. Scroll the first flagged field into view ourselves.
    const first = containerRef.current?.querySelector("[data-invalid='true']");
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function onValid(formValues: AutoSwitcherFormValues) {
    const saving = upsertAutoSwitcherConfig(formValues).then((result) => {
      if (!result.ok) throw new Error(result.error);
      if (result.data) onSaved(result.data);
      // Reset to the saved values so the form stops reading as dirty.
      form.reset(defaultsFrom(result.data ?? null));
      return result;
    });
    toast.promise(saving, {
      loading: "Saving…",
      success: "Saved. The switcher picks this up within a second.",
      error: (err: Error) => err.message || "Could not save your settings",
    });
    // Await so isSubmitting (and the save bar's spinner) tracks the round-trip.
    // The toast already surfaced any failure.
    await saving.catch(() => undefined);
  }

  // Refs, not state: the deck shell reads these when the user taps Save/Discard.
  // Re-published every render so the closures never go stale.
  useEffect(() => {
    actionsRef.current = {
      save: () => void submit(),
      discard: () => form.reset(defaultsFrom(config)),
    };
  });

  const advanced = values.mode === "advanced";
  const thresholds = values.advanced_thresholds;
  const locked = !canInteract;

  function setThreshold(key: keyof AutoSwitcherThresholds, next: number) {
    if (!thresholds) return;
    form.setValue("advanced_thresholds", { ...thresholds, [key]: next }, { shouldDirty: true });
  }

  function setAdvanced(on: boolean) {
    form.setValue("mode", on ? "advanced" : "simple", { shouldDirty: true });
    if (on && !form.getValues("advanced_thresholds")) {
      // Seed the matrix from the active preset so flipping modes never silently
      // changes behaviour.
      form.setValue(
        "advanced_thresholds",
        { ...AUTO_SWITCHER_PRESET_THRESHOLDS[values.sensitivity_preset as AutoSwitcherSensitivityPreset] },
        { shouldDirty: true },
      );
    }
  }

  return (
    <div ref={containerRef} className="space-y-5">
      <SwitcherStatusStrip status={status} enabled={config?.enabled ?? false} />

      <SettingSection
        title="Sensitivity"
        description="How quickly the auto switcher reacts when your IRL signal gets rough. Scenes and everything else stay on the dashboard."
      >
        <SwitchRow
          label="Advanced mode"
          description="Tune every threshold yourself instead of using a preset."
          checked={advanced}
          disabled={locked}
          onCheckedChange={setAdvanced}
        />

        {advanced ? (
          <div data-invalid={errors.advanced_thresholds ? "true" : undefined}>
            {thresholds ? (
              <div className="divide-y divide-border">
                <p className="px-4 py-3 text-xs text-muted-foreground">
                  One sample arrives per second. Trigger, recover and startup are how many seconds in a row a value must be bad
                  (or good) before the switcher acts.
                </p>
                {THRESHOLD_GROUPS.map((group) => (
                  <Collapsible key={group.key}>
                    <CollapsibleTrigger className="group/threshold flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-accent">
                      <span className="text-sm font-medium">{group.label}</span>
                      <span className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                        {group.limit.label} {thresholds[group.limit.field]} {group.limit.unit}
                        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/threshold:rotate-180" />
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="divide-y divide-border border-t bg-muted/30">
                      <StepperRow
                        label={group.limit.label}
                        unit={group.limit.unit}
                        value={thresholds[group.limit.field]}
                        min={group.limit.min}
                        max={group.limit.max}
                        step={group.limit.step}
                        disabled={locked}
                        onChange={(next) => setThreshold(group.limit.field, next)}
                      />
                      <StepperRow
                        label="Trigger"
                        description="Seconds bad before it switches away"
                        unit="seconds"
                        value={thresholds[group.trigger]}
                        min={1}
                        max={120}
                        disabled={locked}
                        onChange={(next) => setThreshold(group.trigger, next)}
                      />
                      <StepperRow
                        label="Recover"
                        description="Seconds good before it switches back"
                        unit="seconds"
                        value={thresholds[group.recover]}
                        min={1}
                        max={300}
                        disabled={locked}
                        onChange={(next) => setThreshold(group.recover, next)}
                      />
                      <StepperRow
                        label="Startup"
                        description="Seconds good before it arms at all"
                        unit="seconds"
                        value={thresholds[group.startup]}
                        min={1}
                        max={120}
                        disabled={locked}
                        onChange={(next) => setThreshold(group.startup, next)}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                ))}
                <StepperRow
                  label="Offline after"
                  description="Seconds of silence before it calls the signal gone"
                  unit="seconds"
                  value={thresholds.offline_timeout_seconds}
                  min={2}
                  max={60}
                  disabled={locked}
                  onChange={(next) => setThreshold("offline_timeout_seconds", next)}
                />
              </div>
            ) : (
              <SettingRow label="Thresholds" error={errors.advanced_thresholds?.message ?? "Advanced mode needs threshold values."} />
            )}
          </div>
        ) : (
          <ChoiceCards
            value={values.sensitivity_preset as AutoSwitcherSensitivityPreset}
            disabled={locked}
            onChange={(next) => form.setValue("sensitivity_preset", next, { shouldDirty: true })}
            options={(Object.keys(PRESET_COPY) as AutoSwitcherSensitivityPreset[]).map((key) => ({
              value: key,
              title: PRESET_COPY[key].title,
              blurb: PRESET_COPY[key].blurb,
            }))}
          />
        )}
      </SettingSection>

      {hasHiddenErrors ? (
        <p className="px-1 text-xs text-destructive" data-invalid="true">
          Your switcher setup is missing something (a scene, most likely). Open the auto switcher tab on the dashboard to finish
          it, then this saves fine.
        </p>
      ) : null}
    </div>
  );
}
