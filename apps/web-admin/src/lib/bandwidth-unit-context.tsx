"use client";

import { createContext, useContext, useState } from "react";
import type { BandwidthUnit } from "./utils";
import { DASHBOARD_COOKIE, writeDashboardCookie } from "./dashboard-prefs";

// Global toggle for how every bandwidth readout renders — bits/s (Mbit/s, the
// stream-operator default) or bytes/s (KB/MB/s). Mirrors time-range-context:
// one provider at the monitor layout, consumed by the bandwidth charts and the
// OBS node/instance tables. The choice persists in a cookie the server layout
// reads back into initialUnit on the next load.

const DEFAULT_UNIT: BandwidthUnit = "bits";

export function parseBandwidthUnit(value: string | undefined): BandwidthUnit {
  return value === "bytes" || value === "bits" ? value : DEFAULT_UNIT;
}

type BandwidthUnitContextValue = {
  unit: BandwidthUnit;
  setUnit: (unit: BandwidthUnit) => void;
  toggle: () => void;
};

const BandwidthUnitContext = createContext<BandwidthUnitContextValue>({
  unit: DEFAULT_UNIT,
  setUnit: () => {},
  toggle: () => {},
});

export function BandwidthUnitProvider({
  initialUnit,
  children,
}: {
  /** Raw cookie value from the server layout; parsed here so the same input
   *  drives both the SSR render and client hydration. */
  initialUnit?: string;
  children: React.ReactNode;
}) {
  const [unit, setUnitState] = useState<BandwidthUnit>(() => parseBandwidthUnit(initialUnit));

  const setUnit = (next: BandwidthUnit) => {
    setUnitState(next);
    writeDashboardCookie(DASHBOARD_COOKIE.bandwidthUnit, next);
  };
  const toggle = () => setUnit(unit === "bits" ? "bytes" : "bits");

  return (
    <BandwidthUnitContext.Provider value={{ unit, setUnit, toggle }}>
      {children}
    </BandwidthUnitContext.Provider>
  );
}

export function useBandwidthUnit() {
  return useContext(BandwidthUnitContext);
}
