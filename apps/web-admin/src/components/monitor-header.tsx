"use client";

import { usePathname } from "next/navigation";
import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Separator, SidebarTrigger } from "@repo/ui";
import { RefreshIntervalSelector } from "@/components/refresh-interval-selector";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { BandwidthUnitToggle } from "@/components/bandwidth-unit-toggle";
import { findNavLocation } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

const ENV_BADGE_CLASSES: Record<string, string> = {
  prod: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  staging: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  dev: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export function MonitorHeader({ envLabel }: { envLabel: string }) {
  const pathname = usePathname();
  const location = findNavLocation(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 !h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {location && location.group.label !== location.item.label && (
            <>
              <BreadcrumbItem className="hidden sm:block text-muted-foreground">
                {location.group.label}
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block" />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage>{location?.item.label ?? "Admin"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-3">
        <BandwidthUnitToggle />
        <TimeRangeSelector />
        <RefreshIntervalSelector />
        <Badge variant="outline" className={cn("uppercase", ENV_BADGE_CLASSES[envLabel])}>
          {envLabel}
        </Badge>
      </div>
    </header>
  );
}
