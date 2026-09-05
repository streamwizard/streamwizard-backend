"use client";

import { ColorPicker, Label, Switch } from "@repo/ui";

/** Unit suffix inside a NumberField, same placement the overlay inspector uses. */
export function Unit({ children }: { children: React.ReactNode }) {
  return <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{children}</span>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1" data-field={label.toLowerCase()}>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function SwitchRow({ id, label, checked, onCheckedChange, helper }: { id: string; label: string; checked: boolean; onCheckedChange: (v: boolean) => void; helper?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-[11px] text-muted-foreground">
          {label}
        </Label>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </div>
      {helper && <p className="text-[11px] leading-snug text-muted-foreground/80">{helper}</p>}
    </div>
  );
}

export function ColourRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <ColorPicker value={value} onChange={onChange} aria-label={`${label} colour`} />
    </div>
  );
}
