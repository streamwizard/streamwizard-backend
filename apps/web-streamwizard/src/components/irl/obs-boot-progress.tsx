"use client";

import { Check, Loader2 } from "lucide-react";
import { cn } from "@repo/ui";

export type BootPhase = "provisioning" | "booting";

interface Step {
  key: string;
  label: string;
  hint: string;
}

const STEPS: Step[] = [
  {
    key: "provision",
    label: "Provisioning container",
    hint: "Grabbing a node and spinning up your container.",
  },
  {
    key: "boot",
    label: "Booting OBS",
    hint: "OBS is starting inside the container. Usually 10-30 seconds.",
  },
  {
    key: "ready",
    label: "Ready to stream",
    hint: "Connected to OBS.",
  },
];

interface ObsBootProgressProps {
  phase: BootPhase;
  /** Seconds elapsed since the launch flow began, shown on the active step. */
  elapsedSeconds: number;
}

/**
 * Staged progress for the launch → boot → connected sequence. The wait can run
 * 10–90s, so a single spinner reads as "stuck"; the stepper plus a live elapsed
 * timer keeps the wait legible and reassures the user that work is happening.
 */
export function ObsBootProgress({ phase, elapsedSeconds }: ObsBootProgressProps) {
  const activeIndex = phase === "provisioning" ? 0 : 1;

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <ol className="space-y-0">
        {STEPS.map((step, i) => {
          const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
          const isLast = i === STEPS.length - 1;
          return (
            <li key={step.key} className="flex gap-3">
              {/* Indicator + connector rail */}
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    state === "done" && "border-green-500 bg-green-500/10 text-green-500",
                    state === "active" && "border-primary text-primary",
                    state === "pending" && "border-border text-muted-foreground/40"
                  )}
                >
                  {state === "done" ? (
                    <Check className="h-3 w-3" />
                  ) : state === "active" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </span>
                {!isLast && (
                  <span
                    className={cn(
                      "my-1 w-px flex-1",
                      i < activeIndex ? "bg-green-500/40" : "bg-border"
                    )}
                  />
                )}
              </div>

              {/* Label + contextual hint */}
              <div className={cn("min-w-0", !isLast && "pb-3")}>
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      "text-sm font-medium leading-5",
                      state === "pending" && "text-muted-foreground/50"
                    )}
                  >
                    {step.label}
                  </p>
                  {state === "active" && (
                    <span className="text-xs tabular-nums text-muted-foreground">{elapsedSeconds}s</span>
                  )}
                </div>
                {state === "active" && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.hint}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
