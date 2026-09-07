"use client";

import { Button } from "@repo/ui";
import { useBandwidthUnit } from "@/lib/bandwidth-unit-context";

// Flips every bandwidth readout in the dashboard between bits/s and bytes/s.
// Sits in the header alongside the time-range and refresh selectors.
export function BandwidthUnitToggle() {
  const { unit, toggle } = useBandwidthUnit();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Bandwidth</span>
      <Button
        variant="outline"
        size="sm"
        className="h-7 w-[52px] px-2 text-xs font-normal tabular-nums"
        onClick={toggle}
        title={`Showing ${unit === "bits" ? "bits/s (Mbit/s)" : "bytes/s (MB/s)"} — click to switch`}
      >
        {unit === "bits" ? "bit/s" : "B/s"}
      </Button>
    </div>
  );
}
