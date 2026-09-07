import type { ReactNode } from "react";
import { cn } from "@repo/ui";

/*
 * The hairline panel the public pages use for anything that isn't a demo:
 * `border-white/[0.08]` over `bg-white/[0.03]`, same as the final CTA. No
 * backdrop blur, which the rest of the public tree also avoids.
 */
export function ProsePanel({
  title,
  children,
  className,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8",
        className
      )}
    >
      {title ? <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2> : null}
      <div className={cn("space-y-4 text-muted-foreground", title && "mt-4")}>{children}</div>
    </div>
  );
}
