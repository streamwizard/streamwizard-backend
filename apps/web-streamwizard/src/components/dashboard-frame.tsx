"use client";

import { SiteHeader } from "@/components/site-header";
import { SidebarInset } from "@repo/ui";
import { usePathname } from "next/navigation";

/**
 * Routes that draw their own header. They get the whole inset: no site header,
 * no page padding, and a viewport-high box so the page itself never scrolls.
 */
const FULL_BLEED_ROUTES = [/^\/dashboard\/overlays\/[^/]+\/edit$/];

export function DashboardFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullBleed = FULL_BLEED_ROUTES.some((route) => route.test(pathname));

  // min-w-0: as a flex item, main would otherwise refuse to shrink below its
  // widest child (the overlay canvas past fit zoom) and push the whole
  // dashboard out past the viewport.
  if (fullBleed) {
    return (
      // The inset variant adds a 0.5rem margin above and below from md up.
      <SidebarInset className="min-w-0 h-svh overflow-hidden md:h-[calc(100svh-1rem)]">
        {children}
      </SidebarInset>
    );
  }

  return (
    <SidebarInset className="min-w-0">
      <SiteHeader />
      <div className="w-full p-3 sm:p-5 mx-auto md:gap-6 md:py-6">{children}</div>
    </SidebarInset>
  );
}
