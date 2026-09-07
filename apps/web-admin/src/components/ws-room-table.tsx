"use client";

import { Circle, Radio, Users } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { StatCard } from "@/components/widgets/stat-card";
import { cn } from "@/lib/utils";
import { useMonitor } from "@/components/ws-monitor-provider";

export function WsRoomTable() {
  const { snapshot, status, events } = useMonitor();

  const rooms = snapshot?.rooms ?? [];
  const totalConnections = snapshot?.totalConnections ?? 0;
  const publishersOnline = rooms.filter((r) => r.hasPublisher).length;
  const totalSubscribers = rooms.reduce((acc, r) => acc + r.subscriberCount, 0);

  const recentByRoom = new Map<string, { eventType: string; ts: number }>();
  for (const evt of events) {
    if (evt.kind !== "message") continue;
    const existing = recentByRoom.get(evt.roomId);
    if (!existing || evt.ts > existing.ts) {
      recentByRoom.set(evt.roomId, { eventType: evt.eventType ?? "unknown", ts: evt.ts });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">WS Rooms</h1>
        <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
          <Circle
            className={cn(
              "h-2 w-2 fill-current",
              status === "connected" ? "text-green-500" : status === "connecting" ? "text-yellow-500" : "text-red-500"
            )}
          />
          {status === "connected" ? "Live — snapshots every 5s" : status === "connecting" ? "Connecting…" : "Disconnected"}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Active Rooms" value={rooms.length} />
        <StatCard title="Total Connections" value={totalConnections} />
        <StatCard title="Publishers Online" value={publishersOnline} />
        <StatCard title="Total Subscribers" value={totalSubscribers} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Active Rooms</CardTitle>
        </CardHeader>
        <CardContent>
          {rooms.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              {status !== "connected" ? "Waiting for connection…" : "No active rooms"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room ID</TableHead>
                  <TableHead>Publisher</TableHead>
                  <TableHead>Subscribers</TableHead>
                  <TableHead>Stream</TableHead>
                  <TableHead>Last Event</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => {
                  const recent = recentByRoom.get(room.roomId);
                  return (
                    <TableRow key={room.roomId}>
                      <TableCell className="font-mono text-xs">{room.roomId}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            room.hasPublisher
                              ? "bg-green-600/20 text-green-400 border-green-600/30"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          <Radio className="h-3 w-3 mr-1" />
                          {room.hasPublisher ? "Online" : "Offline"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {room.subscriberCount}
                        </span>
                      </TableCell>
                      <TableCell>
                        {room.streamId ? (
                          <span className="font-mono text-xs text-muted-foreground">{room.streamId.slice(0, 12)}…</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {recent ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">{recent.eventType}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(recent.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
