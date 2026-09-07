"use client";

import type { ReactNode } from "react";
import { Button, Switch, cn } from "@repo/ui";
import { Check, Minus, Plus } from "lucide-react";

// Touch primitives for the deck's sensitivity tab. Everything here is sized for
// a thumb: rows are >=56px and steppers replace number keyboards.

export function SettingSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="px-1">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">{children}</div>
    </section>
  );
}

/** Label + description on the left, whatever control you pass on the right. */
export function SettingRow({
  label,
  description,
  error,
  children,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  error?: string | null;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-14 px-4 py-3", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{label}</p>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {children ? <div className="shrink-0">{children}</div> : null}
      </div>
      {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <SettingRow label={label} description={description}>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={label} />
    </SettingRow>
  );
}

/** Numeric setting with +/- buttons. The readout stays typable for big jumps. */
export function StepperRow({
  label,
  description,
  unit,
  value,
  min,
  max,
  step = 1,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <SettingRow label={label} description={description}>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-xl"
          disabled={disabled || value <= min}
          onClick={() => onChange(clamp(value - step))}
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            const parsed = Number(event.target.value.replace(/[^0-9]/g, ""));
            if (Number.isFinite(parsed)) onChange(parsed);
          }}
          onBlur={() => onChange(clamp(value))}
          aria-label={unit ? `${label} in ${unit}` : label}
          className="h-11 w-16 rounded-xl border bg-background text-center text-sm tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-xl"
          disabled={disabled || value >= max}
          onClick={() => onChange(clamp(value + step))}
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </SettingRow>
  );
}

/** Full-width choice cards, one per row. Replaces the desktop's side-by-side radio columns. */
export function ChoiceCards<T extends string>({
  value,
  options,
  disabled,
  onChange,
}: {
  value: T;
  options: { value: T; title: string; blurb: string }[];
  disabled?: boolean;
  onChange: (next: T) => void;
}) {
  return (
    <div className="space-y-2 p-3">
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors active:bg-accent disabled:opacity-50",
              isSelected && "border-primary bg-primary/5",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{option.title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{option.blurb}</span>
            </span>
            {isSelected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : null}
          </button>
        );
      })}
    </div>
  );
}
