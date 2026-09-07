import type { AlertRule, RuleOverrides } from "../types";
import {
  queryLatestObsNodeFields,
  queryObsInstanceEvents,
} from "@repo/metrics";
import type { Breach } from "../types";
import {
  DISK_CRIT_PCT,
  DISK_WARN_PCT,
  ENCODER_UTIL_WARN_PCT,
  GPU_TEMP_CRIT_C,
  GPU_TEMP_WARN_C,
  INSTANCE_CRASH_LOOP_COUNT,
  INSTANCE_CRASH_LOOP_WINDOW_MIN,
  INSTANCE_CRASH_WINDOW_MIN,
  NODE_CPU_WARN_PCT,
  NODE_RAM_WARN_PCT,
  NODE_SILENT_AFTER_MS,
  NVENC_FPS_LOW,
  VRAM_USED_WARN_PCT,
} from "./thresholds";
import {
  absenceRule,
  customRule,
  obsNodeField,
  pct,
  thresholdRule,
} from "./builders";

/** OBS / GPU node rules. */
export function obsNodeRules(overrides: RuleOverrides): AlertRule[] {
  return [
    // GPU / OBS nodes
    thresholdRule(
      {
        id: "gpu.temp_high",
        title: "GPU temperature high",
        forTicks: 2,
        warn: GPU_TEMP_WARN_C,
        unit: "°C",
        fetch: (ctx) => obsNodeField(ctx, (f) => f.gpu_temp_c),
        format: (node, v, t) => `GPU on ${node} at ${v.toFixed(0)}°C (warn > ${t.warn}°C)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "gpu.temp_crit",
        title: "GPU temperature critical",
        forTicks: 1,
        crit: GPU_TEMP_CRIT_C,
        unit: "°C",
        fetch: (ctx) => obsNodeField(ctx, (f) => f.gpu_temp_c),
        format: (node, v, t) => `GPU on ${node} at ${v.toFixed(0)}°C (crit > ${t.crit}°C)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "gpu.vram_headroom",
        title: "VRAM nearly full",
        forTicks: 2,
        warn: VRAM_USED_WARN_PCT,
        unit: "%",
        fetch: (ctx) => obsNodeField(ctx, (f) => pct(f.vram_used_mb, f.vram_total_mb)),
        format: (node, v, t) => `VRAM on ${node} at ${v.toFixed(1)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "gpu.nvenc_fps_low",
        title: "NVENC encode FPS low",
        forTicks: 2,
        crit: NVENC_FPS_LOW,
        direction: "below",
        unit: "fps",
        // Gate on active encode sessions: an idle (non-streaming) instance uses
        // no NVENC and averageFps reads 0, which would false-fire permanently.
        fetch: (ctx) =>
          obsNodeField(ctx, (f) => ((f.nvenc_sessions ?? 0) > 0 ? f.nvenc_avg_fps : undefined)),
        format: (node, v, t) =>
          `NVENC on ${node} averaging ${v.toFixed(1)} fps with active sessions (crit < ${t.crit})`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "gpu.encoder_util_high",
        title: "NVENC encoder saturated",
        forTicks: 2,
        warn: ENCODER_UTIL_WARN_PCT,
        unit: "%",
        // Field is absent on nodes running a collector that predates it (or
        // boards reporting [N/A]); obsNodeField skips undefined, so no gate.
        fetch: (ctx) => obsNodeField(ctx, (f) => f.encoder_util_pct),
        format: (node, v, t) =>
          `NVENC on ${node} at ${v.toFixed(0)}% utilization (warn > ${t.warn}%) — encode capacity nearly exhausted`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "gpu.nvenc_capacity",
        title: "NVENC encoder slots exhausted",
        forTicks: 2,
        warn: 0,
        tunable: false, // value is a structural margin, not a real threshold
        // Value is sessions minus cap: > 0-threshold means at/over capacity.
        fetch: (ctx) =>
          obsNodeField(ctx, (f) =>
            f.max_encoder_sessions !== undefined && f.max_encoder_sessions > 0 && f.nvenc_sessions !== undefined
              ? f.nvenc_sessions - f.max_encoder_sessions + 1
              : undefined,
          ),
        format: (node) => `All NVENC encoder slots on ${node} are in use`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "obs.node_cpu",
        title: "OBS node CPU high",
        forTicks: 2,
        warn: NODE_CPU_WARN_PCT,
        unit: "%",
        fetch: (ctx) => obsNodeField(ctx, (f) => f.cpu_pct),
        format: (node, v, t) => `CPU on ${node} at ${v.toFixed(1)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "obs.node_ram",
        title: "OBS node RAM high",
        forTicks: 2,
        warn: NODE_RAM_WARN_PCT,
        unit: "%",
        fetch: (ctx) => obsNodeField(ctx, (f) => pct(f.ram_used_mb, f.ram_total_mb)),
        format: (node, v, t) => `RAM on ${node} at ${v.toFixed(1)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    customRule(
      {
        id: "obs.capacity_full",
        title: "OBS fleet at container capacity",
        forTicks: 2,
        async evaluate(ctx) {
          const nodes = await queryLatestObsNodeFields("10m", { bucket: ctx.bucket });
          let running = 0;
          let max = 0;
          for (const node of nodes) {
            running += node.fields.running_instance_count ?? 0;
            max += node.fields.max_instances ?? 0;
          }
          if (max === 0 || running < max) return [];
          return [
            {
              entityId: "",
              severity: "warn",
              value: running,
              message: `OBS fleet is full: ${running}/${max} container slots in use`,
            },
          ];
        },
      },
      overrides,
    ),
    absenceRule(
      {
        id: "obs.node_silent",
        title: "OBS node gone silent",
        measurement: "obs_node",
        tag: "node_id",
        silentAfterMs: NODE_SILENT_AFTER_MS,
        expected: (ctx) =>
          ctx.registry.obsNodes
            .filter((n) => n.status === "linked" && !n.maintenance)
            .map((n) => ({ entityId: n.id, label: n.apiUrl ? `${n.name} (${n.apiUrl})` : n.name })),
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "obs.disk_full",
        title: "OBS node disk filling up",
        forTicks: 2,
        warn: DISK_WARN_PCT,
        crit: DISK_CRIT_PCT,
        unit: "%",
        fetch: (ctx) => obsNodeField(ctx, (f) => f.disk_used_pct),
        format: (node, v, t) => `Disk on ${node} at ${v.toFixed(1)}% (warn > ${t.warn}%, crit > ${t.crit}%)`,
      },
      overrides,
    ),
    // Instance lifecycle events written by obs-instance-manager's watchdog
    // (obs_instance_event measurement). The manager auto-heals crashes
    // silently — these two rules are what make that recovery loud. Event
    // rules auto-resolve once the lookback window slides past the last event.
    customRule(
      {
        id: "obs.instance_crash",
        title: "OBS instance crashed",
        forTicks: 1,
        envs: ["prod", "staging"],
        warn: { default: INSTANCE_CRASH_WINDOW_MIN, unit: "min lookback", direction: "above" },
        async evaluate(ctx, t) {
          const windowMin = Math.max(1, Math.round(t.warn));
          const events = await queryObsInstanceEvents(`${windowMin}m`, { bucket: ctx.bucket });
          const byInstance = new Map<
            string,
            { nodeId: string; crashes: number; restored: boolean; restartFailed: boolean }
          >();
          for (const e of events) {
            const entry =
              byInstance.get(e.instanceId) ??
              { nodeId: e.nodeId, crashes: 0, restored: false, restartFailed: false };
            if (e.event === "crash") entry.crashes += e.count;
            if (e.event === "auto_restarted") entry.restored = true;
            if (e.event === "restart_failed") entry.restartFailed = true;
            byInstance.set(e.instanceId, entry);
          }
          const breaches: Breach[] = [];
          for (const [instanceId, s] of byInstance) {
            if (s.crashes === 0 && !s.restartFailed) continue;
            // A failed auto-restart means the instance is down and the
            // automation gave up — that's the page-worthy case. A crash the
            // watchdog already restarted is informational.
            const what =
              s.crashes > 0
                ? `crashed ${s.crashes}× in ${windowMin}m`
                : "failed to auto-restart";
            const suffix = s.restartFailed
              ? s.crashes > 0
                ? " and auto-restart FAILED"
                : ""
              : s.restored
                ? " (auto-restarted)"
                : "";
            breaches.push({
              entityId: instanceId,
              severity: s.restartFailed ? "crit" : "warn",
              value: s.crashes,
              message: `OBS instance ${instanceId} on ${s.nodeId} ${what}${suffix}`,
            });
          }
          return breaches;
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "obs.instance_crash_loop",
        title: "OBS instance crash-looping",
        forTicks: 1,
        envs: ["prod", "staging"],
        crit: {
          default: INSTANCE_CRASH_LOOP_COUNT,
          unit: `crashes / ${INSTANCE_CRASH_LOOP_WINDOW_MIN}m`,
          direction: "above",
        },
        async evaluate(ctx, t) {
          const events = await queryObsInstanceEvents(`${INSTANCE_CRASH_LOOP_WINDOW_MIN}m`, {
            bucket: ctx.bucket,
          });
          return events
            .filter((e) => e.event === "crash" && e.count >= t.crit)
            .map((e) => ({
              entityId: e.instanceId,
              severity: "crit" as const,
              value: e.count,
              message: `OBS instance ${e.instanceId} on ${e.nodeId} is crash-looping: ${e.count} crashes in ${INSTANCE_CRASH_LOOP_WINDOW_MIN}m`,
            }));
        },
      },
      overrides,
    ),
  ];
}
