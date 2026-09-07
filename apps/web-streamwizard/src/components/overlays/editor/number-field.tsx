"use client";

import { useState } from "react";
import { cn, Input } from "@repo/ui";

/**
 * What the field is willing to hand to the store: a number, or null for "leave
 * it alone" — an empty field, junk, or a value the field itself refuses.
 * Values that parse but are out of the scene's bounds still clamp downstream.
 */
export function parseNumberFieldValue(
  text: string,
  bounds: { min?: number; max?: number } = {}
): number | null {
  if (text.trim() === "") return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  if (bounds.min !== undefined && parsed < bounds.min) return null;
  if (bounds.max !== undefined && parsed > bounds.max) return null;
  return parsed;
}

interface NumberFieldProps {
  value: number;
  /** Called with a parsed, in-range number. Never with NaN or an empty field. */
  onCommit: (value: number) => void;
  onFocus?: () => void;
  /** Bounds the field itself refuses. Out-of-range values elsewhere still clamp. */
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
  /** Rendered inside the field's own wrapper, e.g. a "%" suffix. */
  adornment?: React.ReactNode;
}

/**
 * A numeric input you are allowed to empty.
 *
 * A plain controlled `type="number"` bound to the store has no good answer for a
 * half-typed value: `Number("")` is 0, so clearing the field to retype writes 0
 * and the widget jumps, and a setter that rejects the empty value instead makes
 * the field impossible to clear at all, because the next render puts the old
 * number straight back.
 *
 * So the typed text lives here while it is being typed. Anything that parses and
 * is in range commits as you go, an unparseable one just marks the field invalid
 * and writes nothing, and blurring throws the draft away — which shows the last
 * good value again.
 */
export function NumberField({
  value,
  onCommit,
  onFocus,
  min,
  max,
  disabled,
  className,
  adornment,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const parse = (text: string) => parseNumberFieldValue(text, { min, max });

  const invalid = draft !== null && parse(draft) === null;

  const field = (
    <Input
      type="number"
      value={draft ?? String(value)}
      min={min}
      max={max}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      onFocus={onFocus}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const parsed = parse(text);
        if (parsed !== null) onCommit(parsed);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        const parsed = draft === null ? value : parse(draft);
        if (parsed !== null) onCommit(parsed);
        setDraft(null);
      }}
      // Dropping the draft falls back to the store, so an empty or unparseable
      // field shows the last good value again instead of writing something.
      onBlur={() => setDraft(null)}
      className={cn(
        "h-8 text-sm",
        invalid && "border-destructive focus-visible:ring-destructive/40",
        className
      )}
    />
  );

  if (!adornment) return field;

  return (
    <div className="relative">
      {field}
      {adornment}
    </div>
  );
}
