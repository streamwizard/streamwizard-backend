import { runFluxQuery, assertValidFluxDuration } from "../query-client";
import { resolveBucket, type QueryOpts } from "./query-opts";

// Supabase platform metrics, scraped from the per-project privileged
// Prometheus endpoint by Telegraf on the monitoring host. The prometheus
// parser writes every metric
// into a single measurement named "prometheus" with the metric name as the
// field key — so unlike the app metrics, everything here filters on _field.
//
// Counter fields (*_seconds_total, *_blks_*_total) need a derivative before
// they mean anything; gauge fields are used as-is.

export interface PlatformPoint {
  time: string;
  value: number;
}

const point = (row: Record<string, string | undefined>): PlatformPoint => ({
  time: row._time ?? "",
  value: Number(row._value),
});

/** DB host CPU usage % over time: 100 × busy / (busy + idle) from the
 * per-core mode counters. */
export function querySupabaseDbCpuPct(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<PlatformPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "node_cpu_seconds_total")
      |> derivative(unit: 1s, nonNegative: true)
      |> map(fn: (r) => ({ r with kind: if r.mode == "idle" then "idle" else "busy" }))
      |> group(columns: ["kind"])
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> pivot(rowKey: ["_time"], columnKey: ["kind"], valueColumn: "_value")
      |> map(fn: (r) => ({ _time: r._time, _value: if r.busy + r.idle == 0.0 then 0.0 else 100.0 * r.busy / (r.busy + r.idle) }))
      |> yield(name: "db_cpu_pct")
  `;
  return runFluxQuery(query, point);
}

/** DB host memory usage % over time: 100 × (1 − MemAvailable / MemTotal). */
export function querySupabaseDbMemoryPct(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<PlatformPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "node_memory_MemAvailable_bytes" or r._field == "node_memory_MemTotal_bytes")
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> map(fn: (r) => ({ _time: r._time, _value: if r.node_memory_MemTotal_bytes == 0.0 then 0.0 else 100.0 * (1.0 - r.node_memory_MemAvailable_bytes / r.node_memory_MemTotal_bytes) }))
      |> yield(name: "db_memory_pct")
  `;
  return runFluxQuery(query, point);
}

/** Fullest filesystem usage % over time (max across mountpoints). */
export function querySupabaseDbDiskPct(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<PlatformPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "node_filesystem_avail_bytes" or r._field == "node_filesystem_size_bytes")
      |> keep(columns: ["_time", "_field", "_value", "mountpoint"])
      |> pivot(rowKey: ["_time", "mountpoint"], columnKey: ["_field"], valueColumn: "_value")
      |> map(fn: (r) => ({ _time: r._time, _value: if r.node_filesystem_size_bytes == 0.0 then 0.0 else 100.0 * (1.0 - r.node_filesystem_avail_bytes / r.node_filesystem_size_bytes) }))
      |> group()
      |> aggregateWindow(every: ${window}, fn: max, createEmpty: false)
      |> yield(name: "db_disk_pct")
  `;
  return runFluxQuery(query, point);
}

/** Total backends (connections) across databases, over time. */
export function querySupabaseDbConnections(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<PlatformPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "pg_stat_database_num_backends")
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> group()
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> yield(name: "db_connections")
  `;
  return runFluxQuery(query, point);
}

/** The connection limit (max_connections), latest value. */
export async function querySupabaseMaxConnections(opts?: QueryOpts): Promise<number | null> {
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "max_connections_connection_count")
      |> group()
      |> last()
      |> yield(name: "max_connections")
  `;
  const rows = await runFluxQuery(query, point);
  return rows.length > 0 && rows[0] ? rows[0].value : null;
}

/** Buffer cache hit rate % over time: 100 × hit / (hit + read). Windows with
 * no reads at all count as 100%. */
export function querySupabaseDbCacheHitPct(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<PlatformPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "pg_stat_database_blks_hit_total" or r._field == "pg_stat_database_blks_read_total")
      |> derivative(unit: 1s, nonNegative: true)
      |> map(fn: (r) => ({ r with kind: if r._field == "pg_stat_database_blks_hit_total" then "hit" else "read" }))
      |> group(columns: ["kind"])
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> pivot(rowKey: ["_time"], columnKey: ["kind"], valueColumn: "_value")
      |> map(fn: (r) => ({ _time: r._time, _value: if r.hit + r.read == 0.0 then 100.0 else 100.0 * r.hit / (r.hit + r.read) }))
      |> yield(name: "db_cache_hit_pct")
  `;
  return runFluxQuery(query, point);
}

/** Mean statement execution time in ms over time, from the DB-wide
 * pg_stat_statements counters: Δtotal_time / Δtotal_queries. */
export function querySupabaseMeanQueryMs(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<PlatformPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "pg_stat_statements_total_time_seconds" or r._field == "pg_stat_statements_total_queries")
      |> derivative(unit: 1s, nonNegative: true)
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> map(fn: (r) => ({ _time: r._time, _value: if r.pg_stat_statements_total_queries == 0.0 then 0.0 else 1000.0 * r.pg_stat_statements_total_time_seconds / r.pg_stat_statements_total_queries }))
      |> yield(name: "db_mean_query_ms")
  `;
  return runFluxQuery(query, point);
}

/** Statements executed per second, over time. */
export function querySupabaseQueryRate(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<PlatformPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "pg_stat_statements_total_queries")
      |> derivative(unit: 1s, nonNegative: true)
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> yield(name: "db_query_rate")
  `;
  return runFluxQuery(query, point);
}

/** Mean auth (GoTrue) API request latency in ms over time, summed across
 * routes: Δduration_sum / Δrequest_count. PostgREST exposes no equivalent —
 * data-path latency comes from app-side instrumentation instead. */
export function querySupabaseAuthApiMs(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<PlatformPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "http_server_request_duration_seconds_sum" or r._field == "http_server_request_duration_seconds_count")
      |> derivative(unit: 1s, nonNegative: true)
      |> map(fn: (r) => ({ r with kind: if r._field == "http_server_request_duration_seconds_sum" then "sum" else "count" }))
      |> group(columns: ["kind"])
      |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)
      |> pivot(rowKey: ["_time"], columnKey: ["kind"], valueColumn: "_value")
      |> map(fn: (r) => ({ _time: r._time, _value: if r.count == 0.0 then 0.0 else 1000.0 * r.sum / r.count }))
      |> yield(name: "auth_api_ms")
  `;
  return runFluxQuery(query, point);
}

export interface AuthRouteStat {
  route: string;
  method: string;
  count: number;
  meanMs: number;
}

/** Auth (GoTrue) API calls per route over the range: request count and mean
 * latency, busiest first. increase() handles counter resets; per-series
 * increases are summed across status codes before the sum/count ratio. */
export function querySupabaseAuthRoutes(fluxRange = "24h", opts?: QueryOpts): Promise<AuthRouteStat[]> {
  assertValidFluxDuration(fluxRange, "range");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "http_server_request_duration_seconds_sum" or r._field == "http_server_request_duration_seconds_count")
      |> map(fn: (r) => ({ r with kind: if r._field == "http_server_request_duration_seconds_sum" then "sum" else "count" }))
      |> increase()
      |> last()
      |> group(columns: ["http_route", "http_request_method", "kind"])
      |> sum()
      |> group()
      |> pivot(rowKey: ["http_route", "http_request_method"], columnKey: ["kind"], valueColumn: "_value")
      |> filter(fn: (r) => exists r.count and r.count > 0.0)
      |> map(fn: (r) => ({ http_route: r.http_route, http_request_method: r.http_request_method, count: r.count, mean_ms: 1000.0 * r.sum / r.count }))
      |> sort(columns: ["count"], desc: true)
      |> yield(name: "auth_routes")
  `;
  return runFluxQuery(query, (row) => ({
    route: row.http_route ?? "unknown",
    method: row.http_request_method ?? "?",
    count: Number(row.count),
    meanMs: Number(row.mean_ms),
  }));
}

export interface DatabaseSize {
  database: string;
  sizeBytes: number;
}

/** Latest size per database. */
export function querySupabaseDbSizes(opts?: QueryOpts): Promise<DatabaseSize[]> {
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "pg_database_size_bytes")
      |> group(columns: ["datname"])
      |> last()
      |> yield(name: "db_sizes")
  `;
  return runFluxQuery(query, (row) => ({
    database: row.datname ?? "unknown",
    sizeBytes: Number(row._value),
  }));
}

export interface SupabasePlatformSnapshot {
  cpuPct: number | null;
  memoryPct: number | null;
  diskPct: number | null;
  connections: number | null;
  maxConnections: number | null;
  lastScrape: string | null;
}

/** Latest value of each headline metric — stat cards and alert rules 25–28.
 * Nulls mean Telegraf hasn't delivered that series recently. */
export async function querySupabasePlatformSnapshot(opts?: QueryOpts): Promise<SupabasePlatformSnapshot> {
  const last = (rows: PlatformPoint[]): number | null => {
    const r = rows.at(-1);
    return r === undefined ? null : r.value;
  };
  const [cpu, memory, disk, connections, maxConnections, scrape] = await Promise.all([
    querySupabaseDbCpuPct("15m", "5m", opts),
    querySupabaseDbMemoryPct("15m", "5m", opts),
    querySupabaseDbDiskPct("15m", "5m", opts),
    querySupabaseDbConnections("15m", "5m", opts),
    querySupabaseMaxConnections(opts),
    querySupabaseLastScrape(opts),
  ]);
  return {
    cpuPct: last(cpu),
    memoryPct: last(memory),
    diskPct: last(disk),
    connections: last(connections),
    maxConnections,
    lastScrape: scrape,
  };
}

/** Timestamp of the newest platform point — absence rule 28 (scrape silent). */
export async function querySupabaseLastScrape(opts?: QueryOpts): Promise<string | null> {
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -24h)
      |> filter(fn: (r) => r._measurement == "prometheus")
      |> filter(fn: (r) => r._field == "pg_up")
      |> group()
      |> last()
      |> yield(name: "last_scrape")
  `;
  const rows = await runFluxQuery(query, (row) => row._time ?? "");
  return rows.length > 0 && rows[0] ? rows[0] : null;
}
