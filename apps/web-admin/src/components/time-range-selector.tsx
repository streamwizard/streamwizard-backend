"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { TIME_RANGE_OPTIONS, useTimeRange } from "@/lib/time-range-context";

export function TimeRangeSelector() {
  const { range, setRange } = useTimeRange();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Range</span>
      <Select
        value={range.fluxRange}
        onValueChange={(val) => {
          const found = TIME_RANGE_OPTIONS.find((o) => o.fluxRange === val);
          if (found) setRange(found);
        }}
      >
        <SelectTrigger className="h-7 w-[88px] text-xs px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TIME_RANGE_OPTIONS.map((opt) => (
            <SelectItem key={opt.fluxRange} value={opt.fluxRange} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
