"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { captureEvent } from "@repo/posthog";

/*
 * Reports `section_viewed` once per mount when a section has been meaningfully
 * on screen: at least 40% of it, or of the viewport for sections taller than
 * the viewport. Wrap a section's content in it; it renders a plain <div> that
 * does not change layout.
 *
 * The point is the scroll funnel: which sections a visitor reached before
 * they clicked (or did not click) Connect Twitch. `$pageleave` already carries
 * max scroll percentage, but a percentage does not say which section it was.
 */
export function SectionView({
  section,
  children,
  className,
}: {
  section: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Ref, not a closure variable: an effect re-run (Strict Mode remount, or a
  // future dynamic `section`) would reset a `let` and fire a second time.
  const fired = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (fired.current || !entry.isIntersecting) continue;
          // Tall sections never reach 40% of themselves on a phone, so count
          // them viewed once they fill 40% of the viewport instead.
          const viewportShare =
            entry.intersectionRect.height / Math.max(entry.rootBounds?.height ?? window.innerHeight, 1);
          if (entry.intersectionRatio < 0.4 && viewportShare < 0.4) continue;
          fired.current = true;
          captureEvent("section_viewed", { section });
          observer.disconnect();
        }
      },
      { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [section]);

  return (
    <div ref={ref} className={className} data-section={section}>
      {children}
    </div>
  );
}
