"use client";

import { createContext, useContext, useState } from "react";
import { DASHBOARD_COOKIE, writeDashboardCookie } from "./dashboard-prefs";

export const REFRESH_OPTIONS = [
  { label: "5s", value: 5_000 },
  { label: "10s", value: 10_000 },
  { label: "30s", value: 30_000 },
  { label: "1m", value: 60_000 },
  { label: "2m", value: 120_000 },
  { label: "5m", value: 300_000 },
] as const;

const DEFAULT_INTERVAL = 5_000;

// Resolve a persisted interval (the cookie value) to a known option, falling
// back to the default for unknown/absent values.
export function parseRefreshInterval(value: string | undefined): number {
  const ms = Number(value);
  return REFRESH_OPTIONS.some((o) => o.value === ms) ? ms : DEFAULT_INTERVAL;
}

type RefreshIntervalContextValue = {
  interval: number;
  setInterval: (ms: number) => void;
};

const RefreshIntervalContext = createContext<RefreshIntervalContextValue>({
  interval: DEFAULT_INTERVAL,
  setInterval: () => {},
});

export function RefreshIntervalProvider({
  initialInterval,
  children,
}: {
  /** Raw cookie value (ms as a string) from the server layout; parsed here so
   *  the same input drives both the SSR render and client hydration. */
  initialInterval?: string;
  children: React.ReactNode;
}) {
  const [interval, setIntervalState] = useState(() => parseRefreshInterval(initialInterval));

  const setInterval = (ms: number) => {
    setIntervalState(ms);
    writeDashboardCookie(DASHBOARD_COOKIE.refreshInterval, String(ms));
  };

  return (
    <RefreshIntervalContext.Provider value={{ interval, setInterval }}>
      {children}
    </RefreshIntervalContext.Provider>
  );
}

export function useRefreshInterval() {
  return useContext(RefreshIntervalContext);
}
