import {
  queryWsConnections,
  queryWsMessages,
  queryWsAuthFailures,
  queryWsDroppedMessages,
  queryWsConnectionDuration,
  queryWsRoomEvents,
  queryWsActiveConnectionsEstimate,
  queryWsTopMessageTypes,
} from "@repo/metrics";
import type {
  WsConnectionPoint,
  WsMessagePoint,
  WsAuthFailurePoint,
  WsMessageDropPoint,
  WsConnectionDurationPoint,
  WsRoomEventPoint,
  WsTopMessageTypePoint,
} from "@repo/metrics";
import { WsConnectionChart } from "@/components/charts/ws-connection-chart";
import { WsMessageChart } from "@/components/charts/ws-message-chart";
import { WsAuthFailureChart } from "@/components/charts/ws-auth-failure-chart";
import { WsMessageDropChart } from "@/components/charts/ws-message-drop-chart";
import { WsConnectionDurationChart } from "@/components/charts/ws-connection-duration-chart";
import { WsTopEventsTable } from "@/components/charts/ws-top-events-table";
import { StatCard } from "@/components/widgets/stat-card";

export const dynamic = "force-dynamic";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export default async function WsDashboard() {
  let connections: WsConnectionPoint[] = [];
  let messages: WsMessagePoint[] = [];
  let authFailures: WsAuthFailurePoint[] = [];
  let droppedMessages: WsMessageDropPoint[] = [];
  let connectionDuration: WsConnectionDurationPoint[] = [];
  let roomEvents: WsRoomEventPoint[] = [];
  let activeConnections: { role: string; active: number }[] = [];
  let topMessageTypes: WsTopMessageTypePoint[] = [];

  try {
    [
      connections,
      messages,
      authFailures,
      droppedMessages,
      connectionDuration,
      roomEvents,
      activeConnections,
      topMessageTypes,
    ] = await Promise.all([
      queryWsConnections("24h", "1h"),
      queryWsMessages("24h", "1h"),
      queryWsAuthFailures("24h", "1h"),
      queryWsDroppedMessages("24h", "1h"),
      queryWsConnectionDuration("24h", "1h"),
      queryWsRoomEvents("24h", "1h"),
      queryWsActiveConnectionsEstimate(),
      queryWsTopMessageTypes("24h"),
    ]);
  } catch {
    // InfluxDB not available — show empty state
  }

  // Compute stat card values
  const totalActive = activeConnections.reduce((acc, c) => acc + c.active, 0);

  const authFailureCount1h = authFailures
    .filter((f) => new Date(f.time).getTime() > Date.now() - 3_600_000)
    .reduce((acc, f) => acc + f.count, 0);

  const dropCount1h = droppedMessages
    .filter((d) => new Date(d.time).getTime() > Date.now() - 3_600_000)
    .reduce((acc, d) => acc + d.count, 0);

  const publisherDurations = connectionDuration.filter((d) => d.role === "publisher");
  const avgPublisherDurationMs =
    publisherDurations.length > 0
      ? publisherDurations.reduce((acc, d) => acc + d.avgMs, 0) / publisherDurations.length
      : null;

  const roomsCreated = roomEvents.filter((e) => e.event === "created").reduce((acc, e) => acc + e.count, 0);
  const roomsDeleted = roomEvents.filter((e) => e.event === "deleted").reduce((acc, e) => acc + e.count, 0);
  const estimatedActiveRooms = Math.max(0, roomsCreated - roomsDeleted);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">WebSocket</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Last 24 hours · refreshes every 30s</p>
      </div>

      {/* Section 1: Health Summary */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Health</h2>
        <div className="grid grid-cols-5 gap-4">
          <StatCard
            title="Active Connections"
            value={totalActive}
            description="Estimated (opens − closes)"
          />
          <StatCard
            title="Auth Failures (1h)"
            value={authFailureCount1h}
            description={authFailureCount1h === 0 ? "All good" : "Check Errors section"}
            className={authFailureCount1h > 0 ? "border-destructive/50" : undefined}
          />
          <StatCard
            title="Dropped Messages (1h)"
            value={dropCount1h}
            description={dropCount1h === 0 ? "All good" : "Check Errors section"}
            className={dropCount1h > 0 ? "border-destructive/50" : undefined}
          />
          <StatCard
            title="Publisher Duration (avg)"
            value={avgPublisherDurationMs !== null ? formatDuration(avgPublisherDurationMs) : "—"}
            description="How long publishers stay connected"
          />
          <StatCard
            title="Active Rooms"
            value={estimatedActiveRooms}
            description="Estimated (created − deleted)"
          />
        </div>
      </section>

      {/* Section 2: Connection Flow */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Connection Flow</h2>
        <div className="grid grid-cols-2 gap-4">
          <WsConnectionChart initialData={connections} />
          <WsConnectionDurationChart initialData={connectionDuration} />
        </div>
      </section>

      {/* Section 3: Errors */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Errors
          {authFailureCount1h + dropCount1h > 0 && (
            <span className="ml-2 text-destructive normal-case font-normal">
              — {authFailureCount1h + dropCount1h} in the last hour
            </span>
          )}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <WsAuthFailureChart initialData={authFailures} />
          <WsMessageDropChart initialData={droppedMessages} />
        </div>
      </section>

      {/* Section 4: Message Flow */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Message Flow</h2>
        <div className="grid grid-cols-2 gap-4">
          <WsMessageChart initialData={messages} />
          <WsTopEventsTable initialData={topMessageTypes} />
        </div>
      </section>
    </div>
  );
}
