"use client";

import { WsMonitorProvider } from "@/components/ws-monitor-provider";
import { WsTopology } from "@/components/topology/ws-topology";

export default function WsTopologyPage() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? null;
  const secret = process.env.NEXT_PUBLIC_MONITOR_SECRET ?? null;

  if (!wsUrl || !secret) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">WS Topology</h1>
        <p className="text-sm text-muted-foreground">
          Set <code className="text-xs bg-muted px-1 py-0.5 rounded">NEXT_PUBLIC_WS_SERVER_URL</code> and{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">NEXT_PUBLIC_MONITOR_SECRET</code> in{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">.env.local</code> to enable topology view.
        </p>
      </div>
    );
  }

  return (
    <WsMonitorProvider wsUrl={wsUrl} monitorSecret={secret}>
      <WsTopology />
    </WsMonitorProvider>
  );
}
