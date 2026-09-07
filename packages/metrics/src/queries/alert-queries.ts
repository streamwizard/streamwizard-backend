import { runFluxQuery, assertValidFluxDuration } from "../query-client";
import { resolveBucket, type QueryOpts } from "./query-opts";

// Read side of the web-admin alert engine. Unlike the dashboard queries
// (time series for charts), every builder here answers one rule-evaluation
// question per entity: "what is the latest/aggregate value in the window?".
// All of them take an explicit QueryOpts bucket so one engine pass can
// evaluate prod, staging and dev in turn.

/** Latest reading of every obs_node field, one row per node. */
export interface ObsNodeLatest {
  nodeId: string;
  time: string;
  fields: Record<string, number>;
}

const OBS_NODE_ALERT_FIELDS = [
  "cpu_pct",
  "ram_used_mb",
  "ram_total_mb",
  "gpu_temp_c",
  "gpu_util_pct",
  "vram_used_mb",
  "vram_total_mb",
  "nvenc_avg_fps",
  "nvenc_sessions",
  "encoder_util_pct",
  "power_draw_w",
  "max_encoder_sessions",
  "running_instance_count",
  "max_instances",
  "disk_used_pct",
] as const;

export async function queryLatestObsNodeFields(range = "10m", opts?: QueryOpts): Promise<ObsNodeLatest[]> {
  assertValidFluxDuration(range, "range");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "obs_node")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> group(columns: ["node_id"])
      |> last(column: "_time")
      |> yield(name: "obs_node_latest")
  `;
  return runFluxQuery(query, (row) => ({
    nodeId: row.node_id ?? "unknown",
    time: row._time ?? "",
    fields: Object.fromEntries(
      OBS_NODE_ALERT_FIELDS.filter((f) => row[f] !== undefined && row[f] !== null).map((f) => [f, Number(row[f])]),
    ),
  }));
}

/** Latest reading of every host_system field (ingest boxes), one row per node. */
export interface HostSystemLatest {
  nodeId: string;
  time: string;
  fields: Record<string, number>;
}

const HOST_SYSTEM_ALERT_FIELDS = [
  "cpu_pct",
  "mem_used_mb",
  "mem_total_mb",
  "rx_bytes_per_sec",
  "tx_bytes_per_sec",
  "disk_used_pct",
] as const;

export async function queryLatestHostSystemFields(range = "10m", opts?: QueryOpts): Promise<HostSystemLatest[]> {
  assertValidFluxDuration(range, "range");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "host_system")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> group(columns: ["node_id"])
      |> last(column: "_time")
      |> yield(name: "host_system_latest")
  `;
  return runFluxQuery(query, (row) => ({
    nodeId: row.node_id ?? "unknown",
    time: row._time ?? "",
    fields: Object.fromEntries(
      HOST_SYSTEM_ALERT_FIELDS.filter((f) => row[f] !== undefined && row[f] !== null).map((f) => [f, Number(row[f])]),
    ),
  }));
}

/** Most recent sample per ingest session in the window — stall detection
 * compares this against sessions the DB says are live. */
export interface IngestSessionActivity {
  sessionId: string;
  streamKeyId: string;
  userId: string;
  kbps: number;
  lastSeen: string;
}

export async function queryIngestStreamActivity(range = "2m", opts?: QueryOpts): Promise<IngestSessionActivity[]> {
  assertValidFluxDuration(range, "range");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "ingest_stream")
      |> filter(fn: (r) => r._field == "kbps")
      |> group(columns: ["session_id"])
      |> last()
      |> yield(name: "ingest_activity")
  `;
  return runFluxQuery(query, (row) => ({
    sessionId: row.session_id ?? "unknown",
    streamKeyId: row.stream_key_id ?? "unknown",
    userId: row.user_id ?? "unknown",
    kbps: Number(row._value ?? 0),
    lastSeen: row._time ?? "",
  }));
}

/** Request and 5xx counts per service over the window (rule: api.5xx_rate). */
export interface HttpServiceErrorRate {
  service: string;
  total: number;
  errors5xx: number;
}

export async function queryHttpErrorRateByService(range = "5m", opts?: QueryOpts): Promise<HttpServiceErrorRate[]> {
  assertValidFluxDuration(range, "range");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "http_request")
      |> filter(fn: (r) => r._field == "duration_ms")
      |> group(columns: ["service", "status"])
      |> count()
      |> yield(name: "http_status_counts")
  `;
  const rows = await runFluxQuery(query, (row) => ({
    service: row.service ?? "unknown",
    status: row.status ?? "0",
    count: Number(row._value ?? 0),
  }));
  const byService = new Map<string, HttpServiceErrorRate>();
  for (const row of rows) {
    const entry = byService.get(row.service) ?? { service: row.service, total: 0, errors5xx: 0 };
    entry.total += row.count;
    if (row.status.startsWith("5")) entry.errors5xx += row.count;
    byService.set(row.service, entry);
  }
  return [...byService.values()];
}

/** p95 request latency per service over the window (rule: api.p95_latency). */
export interface HttpServiceP95 {
  service: string;
  p95Ms: number;
}

export async function queryHttpP95ByService(range = "10m", opts?: QueryOpts): Promise<HttpServiceP95[]> {
  assertValidFluxDuration(range, "range");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "http_request")
      |> filter(fn: (r) => r._field == "duration_ms")
      |> group(columns: ["service"])
      |> quantile(q: 0.95, method: "estimate_tdigest")
      |> yield(name: "http_p95")
  `;
  return runFluxQuery(query, (row) => ({
    service: row.service ?? "unknown",
    p95Ms: Number(row._value ?? 0),
  }));
}

const TAG_NAME_PATTERN = /^[a-zA-Z0-9_]+$/;
const MEASUREMENT_NAME_PATTERN = /^[a-zA-Z0-9_]+$/;

/**
 * Which tag values wrote to a measurement in the window, and when they last
 * did. The absence rules (node/service/pipeline silent) diff this against the
 * expected registry — Flux can't report entities that wrote nothing.
 */
export interface LastWriteByTag {
  tagValue: string;
  lastSeen: string;
}

export async function queryLastWriteByTag(
  measurement: string,
  tag: string,
  range = "10m",
  opts?: QueryOpts,
): Promise<LastWriteByTag[]> {
  assertValidFluxDuration(range, "range");
  if (!MEASUREMENT_NAME_PATTERN.test(measurement)) throw new Error(`Invalid measurement name: ${measurement}`);
  if (!TAG_NAME_PATTERN.test(tag)) throw new Error(`Invalid tag name: ${tag}`);
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "${measurement}")
      |> group(columns: ["${tag}"])
      |> last(column: "_time")
      |> keep(columns: ["${tag}", "_time"])
      |> yield(name: "last_write")
  `;
  return runFluxQuery(query, (row) => ({
    tagValue: row[tag] ?? "unknown",
    lastSeen: row._time ?? "",
  }));
}

/** Total points written to the bucket in the window across ALL measurements
 * (rule: meta.pipeline_silent — 0 means the whole write path is dead). */
export async function queryBucketPointCount(range = "5m", opts?: QueryOpts): Promise<number> {
  assertValidFluxDuration(range, "range");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${range})
      |> group()
      |> count(column: "_time")
      |> yield(name: "bucket_points")
  `;
  const rows = await runFluxQuery(query, (row) => Number(row._time ?? 0));
  return rows[0] ?? 0;
}

/** Sum of a count-style ws measurement over the window
 * (rules: ws.auth_failure_spike, ws.message_drops).
 *
 * excludeReasons drops rows whose `reason` tag matches — used to keep
 * expected-behavior counters (bot room_not_found: "someone is streaming but
 * nobody is watching") out of alerts that should only see real faults. */
export async function queryWsEventTotal(
  measurement: "ws_auth_failure" | "ws_message_drop",
  range = "5m",
  opts?: QueryOpts,
  excludeReasons: readonly string[] = [],
): Promise<number> {
  assertValidFluxDuration(range, "range");
  for (const reason of excludeReasons) {
    if (!/^[a-z_]+$/.test(reason)) throw new Error(`Invalid reason tag: ${reason}`);
  }
  const bucket = resolveBucket(opts);
  const reasonFilter = excludeReasons.length
    ? `|> filter(fn: (r) => ${excludeReasons.map((r) => `r.reason != "${r}"`).join(" and ")})`
    : "";
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "${measurement}")
      |> filter(fn: (r) => r._field == "count")
      ${reasonFilter}
      |> group()
      |> sum()
      |> yield(name: "ws_event_total")
  `;
  const rows = await runFluxQuery(query, (row) => Number(row._value ?? 0));
  return rows[0] ?? 0;
}

/** Query error rate from the app-side supabase_query measurement
 * (rule: db.query_error_rate). */
export interface DbQueryErrorRate {
  total: number;
  errors: number;
}

export async function queryDbQueryErrorRate(range = "5m", opts?: QueryOpts): Promise<DbQueryErrorRate> {
  assertValidFluxDuration(range, "range");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "supabase_query")
      |> filter(fn: (r) => r._field == "duration_ms")
      |> group(columns: ["success"])
      |> count()
      |> yield(name: "db_query_counts")
  `;
  const rows = await runFluxQuery(query, (row) => ({
    success: row.success ?? "true",
    count: Number(row._value ?? 0),
  }));
  let total = 0;
  let errors = 0;
  for (const row of rows) {
    total += row.count;
    if (row.success === "false") errors += row.count;
  }
  return { total, errors };
}

/** Timestamp of the most recent EventSub delivery (rule: eventsub.silence). */
export async function queryEventsubLastEvent(range = "30m", opts?: QueryOpts): Promise<string | null> {
  assertValidFluxDuration(range, "range");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "eventsub_event")
      |> filter(fn: (r) => r._field == "count")
      |> group()
      |> last(column: "_time")
      |> yield(name: "eventsub_last")
  `;
  const rows = await runFluxQuery(query, (row) => row._time ?? "");
  return rows[0] || null;
}

/** Watchdog lifecycle events per OBS instance (rules: obs.instance_crash,
 * obs.instance_crash_loop). Written by obs-instance-manager on container
 * death and every auto-heal action it takes. */
export interface ObsInstanceEventCount {
  instanceId: string;
  nodeId: string;
  event: string;
  count: number;
}

export async function queryObsInstanceEvents(range = "10m", opts?: QueryOpts): Promise<ObsInstanceEventCount[]> {
  assertValidFluxDuration(range, "range");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${range})
      |> filter(fn: (r) => r._measurement == "obs_instance_event")
      |> filter(fn: (r) => r._field == "count")
      |> group(columns: ["instance_id", "node_id", "event"])
      |> count()
      |> yield(name: "obs_instance_events")
  `;
  return runFluxQuery(query, (row) => ({
    instanceId: row.instance_id ?? "unknown",
    nodeId: row.node_id ?? "unknown",
    event: row.event ?? "unknown",
    count: Number(row._value ?? 0),
  }));
}
