"use client";

import { useRef } from "react";
import Image from "next/image";
import { AnimatedBeam } from "@repo/ui";
import { productNavItems } from "@/components/public/layout/header-nav-items";
import { TrackedLink } from "@/components/public/analytics/tracked-link";

/*
 * The five product pillars around the StreamWizard mark, wired up with
 * animated beams. Each node links to its product page; the copy comes from
 * productNavItems so the constellation can't oversell what the nav promises.
 *
 * productNavItems is imported here rather than passed down: the entries carry
 * Lucide icon components, which do not survive a server-to-client prop
 * boundary.
 *
 * Below md the geometry has no room, so the same data renders as a stacked
 * list. CSS-only switch, both trees always rendered, no hydration branch.
 *
 * Reduced motion: MotionConfig reducedMotion="user" does not stop
 * AnimatedBeam, because its gradient loop is an attribute animation rather
 * than a transform. The whole beam layer is decorative, so it is aria-hidden
 * and removed with motion-reduce:hidden; the static gray track paths go with
 * it, leaving the plain node grid.
 */

/** Pentagon around the center, hand-placed. Order matches productNavItems. */
const NODE_POSITIONS = [
  { left: "50%", top: "8%" }, // Cloud OBS
  { left: "86%", top: "40%" }, // Overlays
  { left: "73%", top: "86%" }, // Clips
  { left: "27%", top: "86%" }, // VOD clipping
  { left: "14%", top: "40%" }, // Analytics
] as const;

const BEAMS = [
  { curvature: -60, delay: 0, duration: 5 },
  { curvature: 40, delay: 0.8, duration: 6 },
  { curvature: 50, delay: 1.6, duration: 5.5 },
  { curvature: -50, delay: 2.4, duration: 6.5 },
  { curvature: -40, delay: 3.2, duration: 5 },
] as const;

export function PillarConstellation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const nodeRef0 = useRef<HTMLDivElement>(null);
  const nodeRef1 = useRef<HTMLDivElement>(null);
  const nodeRef2 = useRef<HTMLDivElement>(null);
  const nodeRef3 = useRef<HTMLDivElement>(null);
  const nodeRef4 = useRef<HTMLDivElement>(null);
  const nodeRefs = [nodeRef0, nodeRef1, nodeRef2, nodeRef3, nodeRef4];

  return (
    <>
      {/* Desktop: the constellation. */}
      <div ref={containerRef} className="relative mx-auto hidden h-[420px] max-w-3xl md:block">
        <div aria-hidden className="motion-reduce:hidden">
          {productNavItems.map((item, i) => (
            <AnimatedBeam
              key={item.cta}
              containerRef={containerRef}
              fromRef={nodeRefs[i]}
              toRef={centerRef}
              curvature={BEAMS[i].curvature}
              delay={BEAMS[i].delay}
              duration={BEAMS[i].duration}
              pathOpacity={0.12}
            />
          ))}
        </div>

        <div
          ref={centerRef}
          className="absolute left-1/2 top-1/2 z-10 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-purple-400/30 bg-background shadow-[0_0_40px_color-mix(in_srgb,var(--color-three),transparent_70%)]"
        >
          <Image alt="StreamWizard" src="/logo.png" width={44} height={44} />
        </div>

        {productNavItems.map((item, i) => (
          <div
            key={item.cta}
            ref={nodeRefs[i]}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: NODE_POSITIONS[i].left, top: NODE_POSITIONS[i].top }}
          >
            <TrackedLink
              href={item.href}
              cta={item.cta}
              section="pillars"
              title={item.description}
              className="flex w-40 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-background px-3 py-2.5 transition-colors hover:border-purple-400/30 hover:bg-purple-400/[0.06]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10">
                <item.icon className="h-4 w-4 text-purple-300" />
              </span>
              <span className="text-sm font-medium">{item.name}</span>
            </TrackedLink>
          </div>
        ))}
      </div>

      {/* Mobile: same data as a stacked list. */}
      <div className="mx-auto max-w-md space-y-3 md:hidden">
        {productNavItems.map((item) => (
          <TrackedLink
            key={item.cta}
            href={item.href}
            cta={item.cta}
            section="pillars"
            className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 transition-colors hover:border-purple-400/30"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10">
              <item.icon className="h-4.5 w-4.5 text-purple-300" />
            </span>
            <span>
              <span className="block text-sm font-medium">{item.name}</span>
              <span className="block text-xs text-muted-foreground">{item.description}</span>
            </span>
          </TrackedLink>
        ))}
      </div>
    </>
  );
}
