import type { ReactNode } from "react";

/** Headings that split an inspector panel into readable groups. */

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
      {children}
    </h3>
  );
}

/** Small caps label used to split a panel into groups. */
export function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider pt-1">
      {children}
    </p>
  );
}
