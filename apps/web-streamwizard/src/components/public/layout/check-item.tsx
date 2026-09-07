import { Check } from "lucide-react";
import type { ReactNode } from "react";

/*
 * The purple-ringed checklist bullet the product sections list features with.
 * Lived inside the cloud OBS showcase until a second section wanted it; the
 * two have to stay identical, so there is one of it.
 */
export function CheckItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/15">
        <Check className="h-3 w-3 text-purple-400" aria-hidden="true" />
      </span>
      <span className="text-sm leading-relaxed text-muted-foreground">{children}</span>
    </li>
  );
}
