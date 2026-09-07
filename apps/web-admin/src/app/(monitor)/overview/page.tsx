import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getOverviewStats } from "@repo/supabase/queries/platform-stats";
import {
  queryWsActiveConnectionsEstimate,
  queryWsAuthFailures,
  queryHttpRequests,
  queryHttpRequestCount,
} from "@repo/metrics";
import { StatCard } from "@/components/widgets/stat-card";
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";

export const dynamic = "force-dynamic";

function formatDuration(startedAt: string | null): string {
  if (!startedAt) return "—";
  const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60_000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default async function OverviewDashboard() {
  // InfluxDB stats — fail gracefully if unavailable
  let totalActiveConnections = 0;
  let authFailureCount = 0;
  let totalRequests = 0;
  let avgLatencyMs: number | null = null;

  try {
    const [activeConns, authFailures, httpRequests, httpCounts] = await Promise.all([
      queryWsActiveConnectionsEstimate(),
      queryWsAuthFailures("1h", "1h"),
      queryHttpRequests("24h", "1h"),
      queryHttpRequestCount("24h"),
    ]);

    totalActiveConnections = activeConns.reduce((acc, c) => acc + c.active, 0);
    authFailureCount = authFailures.reduce((acc, f) => acc + f.count, 0);
    totalRequests = httpCounts.reduce((acc, c) => acc + c.count, 0);
    if (httpRequests.length > 0) {
      avgLatencyMs = httpRequests.reduce((acc, r) => acc + r.durationMs, 0) / httpRequests.length;
    }
  } catch {
    // InfluxDB not available — leave defaults
  }

  const {
    liveStreamers: streamers,
    viewerCounts: viewerCountMap,
    clips: clipsCount,
    failedClipSyncs: failedSyncCount,
    activeOverlayScenes,
    enabledCommands,
  } = await getOverviewStats(supabaseAdmin);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Platform-wide snapshot · live on load</p>
      </div>

      {/* Section 1: System Health */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">System Health</h2>
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            title="Active WS Connections"
            value={totalActiveConnections}
            description="Estimated (opens − closes)"
          />
          <StatCard
            title="Auth Failures (1h)"
            value={authFailureCount}
            description={authFailureCount === 0 ? "All good" : "Check WS metrics"}
            className={authFailureCount > 0 ? "border-destructive/50" : undefined}
          />
          <StatCard
            title="Total Requests (24h)"
            value={totalRequests.toLocaleString()}
            description="HTTP requests across all routes"
          />
          <StatCard
            title="Avg Latency (24h)"
            value={avgLatencyMs !== null ? formatLatency(avgLatencyMs) : "—"}
            description="Mean HTTP response time"
          />
        </div>
      </section>

      {/* Section 2: Database */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Database</h2>
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            title="Total Clips"
            value={clipsCount.toLocaleString()}
            description="All synced clips in DB"
          />
          <StatCard
            title="Failed Syncs"
            value={failedSyncCount}
            description={failedSyncCount === 0 ? "All good" : "Users with failed sync"}
            className={failedSyncCount > 0 ? "border-destructive/50" : undefined}
          />
          <StatCard
            title="Active Overlays"
            value={activeOverlayScenes}
            description="Currently active scenes"
          />
          <StatCard
            title="Enabled Commands"
            value={enabledCommands}
            description="Active channel commands"
          />
        </div>
      </section>

      {/* Section 3: Live Now */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Live Now
          {streamers.length > 0 && (
            <span className="ml-2 text-green-500 normal-case font-normal">
              — {streamers.length} {streamers.length === 1 ? "streamer" : "streamers"}
            </span>
          )}
        </h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current live broadcasters</CardTitle>
          </CardHeader>
          <CardContent>
            {streamers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No streamers live right now.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Broadcaster</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Viewers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {streamers.map((s) => (
                    <TableRow key={s.broadcaster_id}>
                      <TableCell className="font-medium">{s.broadcaster_name}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {s.title ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{s.category_name ?? "—"}</TableCell>
                      <TableCell>{formatDuration(s.stream_started_at)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {viewerCountMap.has(s.broadcaster_id)
                          ? (viewerCountMap.get(s.broadcaster_id)!).toLocaleString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
