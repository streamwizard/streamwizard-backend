import {
  querySupabaseDbCpuPct,
  querySupabaseDbMemoryPct,
  querySupabaseDbDiskPct,
  querySupabaseDbConnections,
  querySupabaseDbCacheHitPct,
  querySupabaseMeanQueryMs,
  querySupabaseQueryRate,
  querySupabaseAuthApiMs,
  querySupabaseDbSizes,
  querySupabasePlatformSnapshot,
  querySupabaseAuthRoutes,
  type AuthRouteStat,
  type DatabaseSize,
  type PlatformPoint,
  type SupabasePlatformSnapshot,
} from "@repo/metrics";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getQueryStats, type QueryStat } from "@repo/supabase/queries/query-stats";
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { PlatformMetricChart } from "@/components/charts/platform-metric-chart";
import { PageHeader } from "@/components/widgets/page-header";
import { StatCard } from "@/components/widgets/stat-card";
import { homeEnv } from "@/lib/home-env";

export const dynamic = "force-dynamic";

function pct(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(1)}%`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default async function SupabasePlatformPage() {
  let cpu: PlatformPoint[] = [];
  let memory: PlatformPoint[] = [];
  let disk: PlatformPoint[] = [];
  let connections: PlatformPoint[] = [];
  let cacheHit: PlatformPoint[] = [];
  let meanQueryMs: PlatformPoint[] = [];
  let queryRate: PlatformPoint[] = [];
  let authApiMs: PlatformPoint[] = [];
  let sizes: DatabaseSize[] = [];
  let snapshot: SupabasePlatformSnapshot | null = null;
  let authRoutes: AuthRouteStat[] = [];
  let queryStats: QueryStat[] = [];

  try {
    [cpu, memory, disk, connections, cacheHit, meanQueryMs, queryRate, authApiMs, sizes, snapshot, authRoutes] =
      await Promise.all([
        querySupabaseDbCpuPct("24h", "1h"),
        querySupabaseDbMemoryPct("24h", "1h"),
        querySupabaseDbDiskPct("24h", "1h"),
        querySupabaseDbConnections("24h", "1h"),
        querySupabaseDbCacheHitPct("24h", "1h"),
        querySupabaseMeanQueryMs("24h", "1h"),
        querySupabaseQueryRate("24h", "1h"),
        querySupabaseAuthApiMs("24h", "1h"),
        querySupabaseDbSizes(),
        querySupabasePlatformSnapshot(),
        querySupabaseAuthRoutes("24h"),
      ]);
  } catch {
    // InfluxDB unavailable — page renders with empty states.
  }

  try {
    queryStats = await getQueryStats(supabaseAdmin, 25);
  } catch {
    // admin_query_stats RPC not deployed to this database yet.
  }

  const scrapeAgeMin = snapshot?.lastScrape
    ? Math.floor((Date.now() - new Date(snapshot.lastScrape).getTime()) / 60_000)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supabase platform"
        description={`Database host metrics for ${homeEnv()} · scraped by Telegraf every minute`}
      />

      <div className="grid grid-cols-5 gap-4">
        <StatCard title="DB CPU" value={pct(snapshot?.cpuPct ?? null)} description="Busy across all cores" />
        <StatCard title="Memory" value={pct(snapshot?.memoryPct ?? null)} description="1 − available / total" />
        <StatCard
          title="Disk"
          value={pct(snapshot?.diskPct ?? null)}
          description="Fullest filesystem"
          className={(snapshot?.diskPct ?? 0) > 80 ? "border-destructive/50" : undefined}
        />
        <StatCard
          title="Connections"
          value={
            snapshot?.connections !== null && snapshot?.connections !== undefined
              ? `${Math.round(snapshot.connections)}${snapshot.maxConnections ? ` / ${snapshot.maxConnections}` : ""}`
              : "—"
          }
          description="Backends vs max_connections"
        />
        <StatCard
          title="Last scrape"
          value={scrapeAgeMin === null ? "—" : scrapeAgeMin < 1 ? "now" : `${scrapeAgeMin}m ago`}
          description={scrapeAgeMin === null ? "No data yet" : "Telegraf → InfluxDB"}
          className={scrapeAgeMin !== null && scrapeAgeMin > 5 ? "border-destructive/50" : undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <PlatformMetricChart title="DB CPU %" seriesKey="cpu" initialData={cpu} unit="%" color={1} yMax={100} />
        <PlatformMetricChart title="Memory %" seriesKey="memory" initialData={memory} unit="%" color={2} yMax={100} />
        <PlatformMetricChart title="Disk % (fullest mount)" seriesKey="disk" initialData={disk} unit="%" color={3} yMax={100} />
        <PlatformMetricChart title="Connections" seriesKey="connections" initialData={connections} color={4} />
        <PlatformMetricChart title="Cache hit %" seriesKey="cacheHit" initialData={cacheHit} unit="%" color={5} yMax={100} />
        <PlatformMetricChart title="Mean query time" seriesKey="meanQueryMs" initialData={meanQueryMs} unit="ms" color={1} />
        <PlatformMetricChart title="Queries / sec" seriesKey="queryRate" initialData={queryRate} color={2} />
        <PlatformMetricChart title="Auth API latency" seriesKey="authApiMs" initialData={authApiMs} unit="ms" color={4} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Database sizes</CardTitle>
          </CardHeader>
          <CardContent>
            {sizes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No size data yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Database</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sizes
                    .slice()
                    .sort((a, b) => b.sizeBytes - a.sizeBytes)
                    .map((s) => (
                      <TableRow key={s.database}>
                        <TableCell className="font-mono text-xs">{s.database}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatBytes(s.sizeBytes)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Top database queries · by total execution time, since last stats reset
          </CardTitle>
        </CardHeader>
        <CardContent>
          {queryStats.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No query stats — the admin_query_stats migration isn&apos;t applied to this database yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Query</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Mean</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queryStats.map((q, i) => (
                  <TableRow key={i}>
                    <TableCell className="max-w-xl">
                      <code className="block truncate font-mono text-xs" title={q.query}>
                        {q.query.replace(/\s+/g, " ")}
                      </code>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{q.calls.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{q.mean_exec_ms.toFixed(2)} ms</TableCell>
                    <TableCell className="text-right tabular-nums">{(q.total_exec_ms / 1000).toFixed(2)} s</TableCell>
                    <TableCell className="text-right tabular-nums">{q.rows_returned.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Auth API calls · per route, last 24h
          </CardTitle>
        </CardHeader>
        <CardContent>
          {authRoutes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No auth API traffic in this range.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Mean latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {authRoutes.map((r) => (
                  <TableRow key={`${r.method} ${r.route}`}>
                    <TableCell className="font-mono text-xs">{r.route}</TableCell>
                    <TableCell className="text-muted-foreground">{r.method}</TableCell>
                    <TableCell className="text-right tabular-nums">{Math.round(r.count).toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.meanMs.toFixed(1)} ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
