import { queryHttpRequests, queryHttpRouteStats } from "@repo/metrics";
import type { HttpRequestPoint, HttpRouteStatPoint } from "@repo/metrics";
import { HttpRequestChart } from "@/components/charts/http-request-chart";
import { HttpRouteTable } from "@/components/charts/http-route-table";
import { StatCard } from "@/components/widgets/stat-card";

export const dynamic = "force-dynamic";

export default async function HttpDashboard() {
  let requests: HttpRequestPoint[] = [];
  let routeStats: HttpRouteStatPoint[] = [];

  try {
    [requests, routeStats] = await Promise.all([
      queryHttpRequests("24h", "1h"),
      queryHttpRouteStats("24h"),
    ]);
  } catch {
    // InfluxDB not available — show empty state
  }

  const totalRequests = requests.length;
  const avgLatency =
    totalRequests > 0
      ? Math.round(requests.reduce((acc, r) => acc + r.durationMs, 0) / totalRequests)
      : 0;
  const errorCount = requests.filter((r) => Number(r.status) >= 400).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">HTTP / API</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Last 24 hours</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Total Requests" value={totalRequests} description="Last 24h" />
        <StatCard title="Avg Latency" value={`${avgLatency}ms`} description="Mean response time" />
        <StatCard title="Errors (4xx/5xx)" value={errorCount} description="Last 24h" />
      </div>

      <HttpRequestChart initialData={requests} />
      <HttpRouteTable initialData={routeStats} />
    </div>
  );
}
