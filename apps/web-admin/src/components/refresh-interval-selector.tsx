"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { REFRESH_OPTIONS, useRefreshInterval } from "@/lib/refresh-interval-context";

export function RefreshIntervalSelector() {
  const { interval, setInterval } = useRefreshInterval();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Refresh</span>
      <Select
        value={String(interval)}
        onValueChange={(val) => setInterval(Number(val))}
      >
        <SelectTrigger className="h-7 w-[64px] text-xs px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REFRESH_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
