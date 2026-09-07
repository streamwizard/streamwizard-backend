import { Check, Timer } from "lucide-react";
import type { ReactNode } from "react";
import type { TimelineEntryData, TimelineStatus } from "@/app/(public)/roadmap/roadmap-data";
import { Reveal } from "@/components/public/home/reveal";
import { TimelineNode } from "./timeline-node";

/*
 * Rows on the roadmap timeline. Server components; the only client code is
 * the node and the Reveal wrapper. The grid template must stay in step with
 * the spine offsets in timeline.tsx: mobile puts a 1.5rem node column on the
 * left (spine at left-3, its centre), desktop puts it in the middle
 * (spine at left-1/2) with cards alternating sides.
 */

type Side = "left" | "right";

function TimelineRow({
  status,
  accent,
  side,
  children,
  /** Vertical offset that lines the node up with the card's first line. */
  nodeOffset = "pt-6",
}: {
  status: TimelineStatus;
  accent?: "amber";
  side: Side;
  children: ReactNode;
  nodeOffset?: string;
}) {
  return (
    <div className="grid grid-cols-[1.5rem_1fr] gap-x-4 md:grid-cols-[1fr_1.5rem_1fr] md:gap-x-8">
      <div className={`col-start-1 row-start-1 flex justify-center md:col-start-2 ${nodeOffset}`}>
        <TimelineNode status={status} accent={accent} />
      </div>
      <div
        className={`col-start-2 row-start-1 min-w-0 ${
          side === "left" ? "md:col-start-1" : "md:col-start-3"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function TimelineEntry({
  entry,
  status,
  side,
  delay = 0,
  children,
}: {
  entry: TimelineEntryData;
  status: TimelineStatus;
  side: Side;
  delay?: number;
  /** Optional extra content under the item list, e.g. the beta note. */
  children?: ReactNode;
}) {
  const iconColor = entry.accent === "amber" ? "text-amber-300" : "text-purple-300";
  /* Planned work hasn't happened yet, so its bullets wait on a timer. */
  const ItemIcon = status === "later" ? Timer : Check;

  return (
    <TimelineRow status={status} accent={entry.accent} side={side}>
      <Reveal direction={side} delay={delay}>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
          <h3 className="text-lg font-semibold">{entry.area}</h3>
          <ul className="mt-4 space-y-2.5">
            {entry.items.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                <ItemIcon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {children}
        </div>
      </Reveal>
    </TimelineRow>
  );
}

/* One-line rows for planned work: one node on the spine each. */
export function TimelineItem({
  text,
  status = "later",
  side,
  delay = 0,
}: {
  text: string;
  status?: TimelineStatus;
  side: Side;
  delay?: number;
}) {
  return (
    <TimelineRow status={status} side={side} nodeOffset="pt-2.5">
      <Reveal direction={side} delay={delay}>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          {text}
        </div>
      </Reveal>
    </TimelineRow>
  );
}
