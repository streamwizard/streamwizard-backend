import { runFluxQuery, assertValidFluxDuration } from "../query-client";
import { resolveBucket, type QueryOpts } from "./query-opts";

// OBS node/instance metrics — written by obs-instance-manager's
// src/services/influx-metrics.ts (obs_node = one point per node per sample,
// obs_instance = one point per running container per sample).

export interface ObsNodeMetricPoint {
  time: string;
  nodeId: string;
  value: number;
}

async function queryObsNodeField(field: string, fluxRange: string, window: string, opts?: QueryOpts): Promise<ObsNodeMetricPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "obs_node")
      |> filter(fn: (r) => r._field == "${field}")
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> yield(name: "${field}")
  `;
  return runFluxQuery(query, (row) => ({
    time: row._time ?? "",
    nodeId: row.node_id ?? "unknown",
    value: Number(row._value),
  }));
}

export function queryObsNodeCpu(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<ObsNodeMetricPoint[]> {
  return queryObsNodeField("cpu_pct", fluxRange, window, opts);
}

export function queryObsNodeRam(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<ObsNodeMetricPoint[]> {
  return queryObsNodeField("ram_used_mb", fluxRange, window, opts);
}

// nvidia-smi's utilization.gpu — time-occupancy, not load. It DROPS when
// clocks boost under encode load and excludes the NVENC ASIC; use
// queryObsNodeEncoderUtil for "is this streaming box saturated".
export function queryObsNodeGpuUtil(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<ObsNodeMetricPoint[]> {
  return queryObsNodeField("gpu_util_pct", fluxRange, window, opts);
}

/** NVENC ASIC busy % — absent from nodes running a collector without the field. */
export function queryObsNodeEncoderUtil(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<ObsNodeMetricPoint[]> {
  return queryObsNodeField("encoder_util_pct", fluxRange, window, opts);
}

export function queryObsNodePower(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<ObsNodeMetricPoint[]> {
  return queryObsNodeField("power_draw_w", fluxRange, window, opts);
}

export function queryObsNodeNvencSessions(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<ObsNodeMetricPoint[]> {
  return queryObsNodeField("nvenc_sessions", fluxRange, window, opts);
}

export function queryObsNodeNvencFps(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<ObsNodeMetricPoint[]> {
  return queryObsNodeField("nvenc_avg_fps", fluxRange, window, opts);
}

export function queryObsNodeVram(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<ObsNodeMetricPoint[]> {
  return queryObsNodeField("vram_used_mb", fluxRange, window, opts);
}

export function queryObsNodeInstanceCount(fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<ObsNodeMetricPoint[]> {
  return queryObsNodeField("running_instance_count", fluxRange, window, opts);
}

export function queryObsNodeBandwidth(
  direction: "rx" | "tx",
  fluxRange = "24h",
  window = "5m",
  opts?: QueryOpts,
): Promise<ObsNodeMetricPoint[]> {
  return queryObsNodeField(`${direction}_bytes_per_sec`, fluxRange, window, opts);
}

export interface ObsNodeSnapshot {
  nodeId: string;
  cpuPct: number;
  ramUsedMb: number;
  ramTotalMb: number;
  gpuUtilPct: number;
  vramUsedMb: number;
  vramTotalMb: number;
  gpuTempC: number;
  /** NVENC ASIC busy %; 0 for nodes whose collector predates the field. */
  encoderUtilPct: number;
  powerDrawW: number;
  nvencSessions: number;
  nvencAvgFps: number;
  runningInstanceCount: number;
  maxInstances: number;
  rxBytesPerSec: number;
  txBytesPerSec: number;
  time: string;
}

// Latest per-node reading across every tracked field — the "fleet at a
// glance" table, one row per node.
// pivot() dissolves _value into one column per field, so last() must be told
// to check _time — its "_value" default errors with `no column "_value" exists`
// (and only once data exists: an empty pivot yields no tables to check).
export async function queryObsNodeSnapshot(opts?: QueryOpts): Promise<ObsNodeSnapshot[]> {
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -10m)
      |> filter(fn: (r) => r._measurement == "obs_node")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> group(columns: ["node_id"])
      |> last(column: "_time")
      |> yield(name: "obs_node_snapshot")
  `;
  return runFluxQuery(query, (row) => ({
    nodeId: row.node_id ?? "unknown",
    cpuPct: Number(row.cpu_pct ?? 0),
    ramUsedMb: Number(row.ram_used_mb ?? 0),
    ramTotalMb: Number(row.ram_total_mb ?? 0),
    gpuUtilPct: Number(row.gpu_util_pct ?? 0),
    vramUsedMb: Number(row.vram_used_mb ?? 0),
    vramTotalMb: Number(row.vram_total_mb ?? 0),
    gpuTempC: Number(row.gpu_temp_c ?? 0),
    encoderUtilPct: Number(row.encoder_util_pct ?? 0),
    powerDrawW: Number(row.power_draw_w ?? 0),
    nvencSessions: Number(row.nvenc_sessions ?? 0),
    nvencAvgFps: Number(row.nvenc_avg_fps ?? 0),
    runningInstanceCount: Number(row.running_instance_count ?? 0),
    maxInstances: Number(row.max_instances ?? 0),
    rxBytesPerSec: Number(row.rx_bytes_per_sec ?? 0),
    txBytesPerSec: Number(row.tx_bytes_per_sec ?? 0),
    time: row._time ?? "",
  }));
}

export interface ObsInstanceMetricPoint {
  time: string;
  instanceId: string;
  value: number;
}

async function queryObsInstanceField(
  instanceId: string,
  field: string,
  fluxRange: string,
  window: string,
  opts?: QueryOpts,
): Promise<ObsInstanceMetricPoint[]> {
  assertValidFluxDuration(fluxRange, "range");
  assertValidFluxDuration(window, "window");
  // instanceId lands inside the Flux source — restrict to uuid-safe characters
  // so it can't break out of the string literal.
  if (!/^[a-zA-Z0-9-]+$/.test(instanceId)) throw new Error("Invalid instance id");
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -${fluxRange})
      |> filter(fn: (r) => r._measurement == "obs_instance")
      |> filter(fn: (r) => r.instance_id == "${instanceId}")
      |> filter(fn: (r) => r._field == "${field}")
      |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)
      |> yield(name: "${field}")
  `;
  return runFluxQuery(query, (row) => ({
    time: row._time ?? "",
    instanceId: row.instance_id ?? "unknown",
    value: Number(row._value),
  }));
}

export function queryObsInstanceCpu(instanceId: string, fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<ObsInstanceMetricPoint[]> {
  return queryObsInstanceField(instanceId, "cpu_pct", fluxRange, window, opts);
}

export function queryObsInstanceRam(instanceId: string, fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<ObsInstanceMetricPoint[]> {
  return queryObsInstanceField(instanceId, "ram_used_mb", fluxRange, window, opts);
}

export function queryObsInstanceVram(instanceId: string, fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<ObsInstanceMetricPoint[]> {
  return queryObsInstanceField(instanceId, "vram_used_mb", fluxRange, window, opts);
}

export function queryObsInstanceRx(instanceId: string, fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<ObsInstanceMetricPoint[]> {
  return queryObsInstanceField(instanceId, "rx_bytes_per_sec", fluxRange, window, opts);
}

export function queryObsInstanceTx(instanceId: string, fluxRange = "24h", window = "5m", opts?: QueryOpts): Promise<ObsInstanceMetricPoint[]> {
  return queryObsInstanceField(instanceId, "tx_bytes_per_sec", fluxRange, window, opts);
}

export interface ObsInstanceSnapshot {
  nodeId: string;
  instanceId: string;
  userId: string;
  cpuPct: number;
  ramUsedMb: number;
  ramLimitMb: number;
  vramUsedMb: number;
  rxBytesPerSec: number;
  txBytesPerSec: number;
  time: string;
}

// Latest per-instance reading — one row per currently-running OBS instance.
export async function queryObsInstanceSnapshot(opts?: QueryOpts): Promise<ObsInstanceSnapshot[]> {
  const bucket = resolveBucket(opts);
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -10m)
      |> filter(fn: (r) => r._measurement == "obs_instance")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> group(columns: ["instance_id"])
      |> last(column: "_time")
      |> yield(name: "obs_instance_snapshot")
  `;
  return runFluxQuery(query, (row) => ({
    nodeId: row.node_id ?? "unknown",
    instanceId: row.instance_id ?? "unknown",
    userId: row.user_id ?? "unknown",
    cpuPct: Number(row.cpu_pct ?? 0),
    ramUsedMb: Number(row.ram_used_mb ?? 0),
    ramLimitMb: Number(row.ram_limit_mb ?? 0),
    vramUsedMb: Number(row.vram_used_mb ?? 0),
    rxBytesPerSec: Number(row.rx_bytes_per_sec ?? 0),
    txBytesPerSec: Number(row.tx_bytes_per_sec ?? 0),
    time: row._time ?? "",
  }));
}
