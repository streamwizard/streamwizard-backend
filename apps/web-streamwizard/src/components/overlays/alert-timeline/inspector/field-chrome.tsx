"use client";

import { Label } from "@repo/ui";

/** Unit suffix inside a NumberField, same placement the overlay inspector uses. */
export function Unit({ children }: { children: React.ReactNode }) {
  return <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{children}</span>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
