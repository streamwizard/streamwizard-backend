"use client";

import { createContext, useContext, useState } from "react";
import { DASHBOARD_COOKIE, writeDashboardCookie } from "./dashboard-prefs";

export interface TimeRangeOption {
  label: string;
  fluxRange: string; // passed directly to InfluxDB range(start: -<fluxRange>)
  window: string;    // InfluxDB aggregateWindow bucket size
}

export const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  // Short ranges use fine windows matched to the ~10s sampler cadence so a
  // stream stopping shows a real drop within seconds, not a minute-long slope
  // from coarse 1m/2m averaging blurring the transition.
  { label: "Last 5m",  fluxRange: "5m",   window: "10s" },
  { label: "Last 15m", fluxRange: "15m",  window: "30s" },
  { label: "Last 30m", fluxRange: "30m",  window: "30s" },
  { label: "Last 1h",  fluxRange: "1h",   window: "5m"  },
  { label: "Last 3h",  fluxRange: "3h",   window: "15m" },
  { label: "Last 6h",  fluxRange: "6h",   window: "30m" },
  { label: "Last 12h", fluxRange: "12h",  window: "1h"  },
  { label: "Last 24h", fluxRange: "24h",  window: "1h"  },
  { label: "Last 2d",  fluxRange: "48h",  window: "2h"  },
  { label: "Last 7d",  fluxRange: "168h", window: "6h"  },
];

const DEFAULT_RANGE = TIME_RANGE_OPTIONS[7]!; // Last 24h

// Resolve a persisted fluxRange (the cookie value) back to its full option,
// falling back to the default for unknown/absent values.
export function parseTimeRange(fluxRange: string | undefined): TimeRangeOption {
  return TIME_RANGE_OPTIONS.find((o) => o.fluxRange === fluxRange) ?? DEFAULT_RANGE;
}

type TimeRangeContextValue = {
  range: TimeRangeOption;
  setRange: (range: TimeRangeOption) => void;
};

const TimeRangeContext = createContext<TimeRangeContextValue>({
  range: DEFAULT_RANGE,
  setRange: () => {},
});

export function TimeRangeProvider({
  initialRange,
  children,
}: {
  /** Raw cookie value (a fluxRange like "5m") from the server layout; resolved
   *  here so the same input drives both the SSR render and client hydration. */
  initialRange?: string;
  children: React.ReactNode;
}) {
  const [range, setRangeState] = useState<TimeRangeOption>(() => parseTimeRange(initialRange));

  const setRange = (next: TimeRangeOption) => {
    setRangeState(next);
    writeDashboardCookie(DASHBOARD_COOKIE.timeRange, next.fluxRange);
  };

  return (
    <TimeRangeContext.Provider value={{ range, setRange }}>
      {children}
    </TimeRangeContext.Provider>
  );
}

export function useTimeRange() {
  return useContext(TimeRangeContext);
}
