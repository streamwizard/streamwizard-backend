"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useMonitorWs, type MonitorEnvelope, type MonitorSnapshot, type ConnectionStatus } from "@/lib/monitor-ws";

interface MonitorContextValue {
  events: MonitorEnvelope[];
  snapshot: MonitorSnapshot | null;
  status: ConnectionStatus;
  eventsPerSec: number;
  clearEvents: () => void;
  setPaused: (paused: boolean) => void;
}

const MonitorContext = createContext<MonitorContextValue | null>(null);

export function WsMonitorProvider({
  wsUrl,
  monitorSecret,
  children,
}: {
  wsUrl: string | null;
  monitorSecret: string | null;
  children: ReactNode;
}) {
  const value = useMonitorWs(wsUrl, monitorSecret);

  return (
    <MonitorContext.Provider value={value}>
      {children}
    </MonitorContext.Provider>
  );
}

export function useMonitor(): MonitorContextValue {
  const ctx = useContext(MonitorContext);
  if (!ctx) throw new Error("useMonitor must be used within WsMonitorProvider");
  return ctx;
}
