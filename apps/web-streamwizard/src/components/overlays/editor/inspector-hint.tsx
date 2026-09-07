"use client";

import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui";

/**
 * A small "?" next to a field label that explains the field on hover or focus.
 * Keeps the explanation out of the panel itself, where a paragraph under every
 * field pushes the settings people came for below the fold. Needs a
 * TooltipProvider above it.
 */
export function InspectorHint({
  label,
  children,
}: {
  /** Accessible name for the trigger, e.g. "About crop". */
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={6} className="max-w-60 text-left leading-snug">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
