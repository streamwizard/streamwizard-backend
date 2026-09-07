"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { JsonView, darkStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import { Pause, Play, Trash2, Circle } from "lucide-react";
import { Badge, Card, CardContent, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { StatCard } from "@/components/widgets/stat-card";
import { cn } from "@/lib/utils";
import { useMonitor } from "@/components/ws-monitor-provider";
import type { MonitorEnvelope } from "@/lib/monitor-ws";

const ROLE_COLORS: Record<string, string> = {
  publisher: "bg-blue-600/20 text-blue-400 border-blue-600/30",
  subscriber: "bg-green-600/20 text-green-400 border-green-600/30",
  bot: "bg-purple-600/20 text-purple-400 border-purple-600/30",
  consumer: "bg-orange-600/20 text-orange-400 border-orange-600/30",
};

const KIND_COLORS: Record<string, string> = {
  message: "bg-chart-1/20 text-chart-1",
  connect: "bg-green-600/20 text-green-400",
  disconnect: "bg-red-600/20 text-red-400",
  room: "bg-yellow-600/20 text-yellow-400",
};

const DIRECTION_ARROWS: Record<string, string> = {
  inbound: "→",
  outbound: "←",
  system: "•",
};

function formatTs(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 1 } as Intl.DateTimeFormatOptions);
}

type RoleFilter = "all" | "publisher" | "subscriber" | "bot" | "consumer";
type KindFilter = "all" | "message" | "connect" | "disconnect" | "room";

export function WsLiveFeed() {
  const { events, snapshot, status, eventsPerSec, clearEvents, setPaused } = useMonitor();
  const [paused, setPausedLocal] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  const parentRef = useRef<HTMLDivElement>(null);

  const togglePause = useCallback(() => {
    setPausedLocal((p) => {
      setPaused(!p);
      return !p;
    });
  }, [setPaused]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (roleFilter !== "all" && e.role !== roleFilter) return false;
      if (kindFilter !== "all" && e.kind !== kindFilter) return false;
      return true;
    });
  }, [events, roleFilter, kindFilter]);

  const virtualizer = useVirtualizer({
    count: filteredEvents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (expandedIdx === index ? 180 : 40),
    overscan: 20,
  });

  const totalRooms = snapshot?.rooms.length ?? 0;
  const totalConnections = snapshot?.totalConnections ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">WS Live</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            <Circle
              className={cn(
                "h-2 w-2 fill-current",
                status === "connected" ? "text-green-500" : status === "connecting" ? "text-yellow-500" : "text-red-500"
              )}
            />
            {status === "connected" ? "Connected" : status === "connecting" ? "Connecting…" : "Disconnected"}
            {status === "connected" && <span className="text-muted-foreground">· {eventsPerSec} evt/s</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="publisher">Publisher</SelectItem>
              <SelectItem value="subscriber">Subscriber</SelectItem>
              <SelectItem value="bot">Bot</SelectItem>
              <SelectItem value="consumer">Consumer</SelectItem>
            </SelectContent>
          </Select>
          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as KindFilter)}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              <SelectItem value="message">Messages</SelectItem>
              <SelectItem value="connect">Connects</SelectItem>
              <SelectItem value="disconnect">Disconnects</SelectItem>
              <SelectItem value="room">Room events</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={togglePause}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={clearEvents}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Events Buffered" value={events.length} description={`Showing ${filteredEvents.length} after filters`} />
        <StatCard title="Events / sec" value={eventsPerSec} />
        <StatCard title="Active Rooms" value={totalRooms} />
        <StatCard title="Total Connections" value={totalConnections} />
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Header row */}
          <div className="grid grid-cols-[100px_40px_90px_120px_1fr_140px] gap-2 px-4 py-2 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>Time</span>
            <span>Dir</span>
            <span>Kind</span>
            <span>Role</span>
            <span>Event</span>
            <span>Room</span>
          </div>
          {/* Virtualized event list */}
          <div ref={parentRef} className="h-[calc(100vh-380px)] overflow-auto">
            {filteredEvents.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                {status !== "connected" ? "Waiting for connection…" : paused ? "Paused — click Resume to continue" : "No events yet"}
              </div>
            ) : (
              <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative", width: "100%" }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const event = filteredEvents[virtualRow.index];
                  if (!event) return null;
                  const isExpanded = expandedIdx === virtualRow.index;

                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <button
                        type="button"
                        className={cn(
                          "w-full grid grid-cols-[100px_40px_90px_120px_1fr_140px] gap-2 px-4 py-2 text-sm text-left border-b border-border/50 hover:bg-muted/30 transition-colors",
                          isExpanded && "bg-muted/20"
                        )}
                        onClick={() => setExpandedIdx(isExpanded ? null : virtualRow.index)}
                      >
                        <span className="text-xs tabular-nums text-muted-foreground">{formatTs(event.ts)}</span>
                        <span className="text-center font-mono">{DIRECTION_ARROWS[event.direction] ?? "•"}</span>
                        <Badge variant="outline" className={cn("text-[10px] justify-center", KIND_COLORS[event.kind])}>
                          {event.kind}
                        </Badge>
                        <Badge variant="outline" className={cn("text-[10px] justify-center truncate", ROLE_COLORS[event.role])}>
                          {event.source ?? event.role}
                        </Badge>
                        <span className="truncate font-mono text-xs">{event.eventType ?? "—"}</span>
                        <span className="truncate text-xs text-muted-foreground font-mono">{event.roomId}</span>
                      </button>
                      {isExpanded && (
                        <div className="px-4 py-3 bg-muted/10 border-b border-border/50">
                          <EventDetail event={event} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EventDetail({ event }: { event: MonitorEnvelope }) {
  return (
    <div className="space-y-2 text-xs">
      {event.meta && (
        <div className="flex gap-4 text-muted-foreground">
          {event.meta.subscriberCount !== undefined && <span>Subscribers: {event.meta.subscriberCount}</span>}
          {event.meta.hasPublisher !== undefined && <span>Publisher: {event.meta.hasPublisher ? "yes" : "no"}</span>}
          {event.meta.durationMs !== undefined && <span>Duration: {(event.meta.durationMs / 1000).toFixed(1)}s</span>}
          {event.meta.sessionId && <span className="font-mono">Session: {event.meta.sessionId.slice(0, 8)}…</span>}
        </div>
      )}
      {event.payload !== undefined && event.payload !== null && (
        <div className="rounded bg-muted/30 p-2 overflow-auto max-h-48">
          <JsonView data={event.payload as object} style={darkStyles} />
        </div>
      )}
      {!event.payload && !event.meta && (
        <span className="text-muted-foreground italic">No additional data</span>
      )}
    </div>
  );
}
