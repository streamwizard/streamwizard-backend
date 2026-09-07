import type { LucideIcon } from "lucide-react";

// Small labelled section divider used to break a dashboard into scannable
// groups. An optional leading icon aids fast visual scanning; the label keeps
// the existing uppercase-muted treatment for continuity.
export function SectionHeading({ icon: Icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {children}
    </h2>
  );
}
