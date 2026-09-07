import type { AlertRule, RuleOverrides } from "../types";
import {
  queryIngestStreamActivity,
} from "@repo/metrics";
import type { Breach } from "../types";
import {
  DISK_CRIT_PCT,
  DISK_WARN_PCT,
  INGEST_BANDWIDTH_WARN_PCT,
  INGEST_NIC_CAPACITY_MBPS,
  INGEST_STALL_MIN_SESSION_AGE_MS,
  NODE_CPU_WARN_PCT,
  NODE_RAM_WARN_PCT,
  NODE_SILENT_AFTER_MS,
} from "./thresholds";
import {
  absenceRule,
  customRule,
  hostSystemField,
  pct,
  thresholdRule,
} from "./builders";

/** Ingest node rules. */
export function ingestRules(overrides: RuleOverrides): AlertRule[] {
  return [
    // Ingest boxes
    thresholdRule(
      {
        id: "ingest.host_cpu",
        title: "Ingest host CPU high",
        forTicks: 2,
        warn: NODE_CPU_WARN_PCT,
        unit: "%",
        fetch: (ctx) => hostSystemField(ctx, (f) => f.cpu_pct),
        format: (node, v, t) => `CPU on ${node} at ${v.toFixed(1)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "ingest.host_mem",
        title: "Ingest host memory high",
        forTicks: 2,
        warn: NODE_RAM_WARN_PCT,
        unit: "%",
        fetch: (ctx) => hostSystemField(ctx, (f) => pct(f.mem_used_mb, f.mem_total_mb)),
        format: (node, v, t) => `Memory on ${node} at ${v.toFixed(1)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "ingest.bandwidth",
        title: "Ingest host bandwidth saturating",
        forTicks: 3,
        warn: INGEST_BANDWIDTH_WARN_PCT,
        unit: "%",
        fetch: (ctx) =>
          hostSystemField(ctx, (f) => {
            const totalBytesPerSec = (f.rx_bytes_per_sec ?? 0) + (f.tx_bytes_per_sec ?? 0);
            const mbps = (totalBytesPerSec * 8) / 1_000_000;
            return (mbps / INGEST_NIC_CAPACITY_MBPS) * 100;
          }),
        format: (node, v, t) =>
          `Bandwidth on ${node} at ${v.toFixed(1)}% of ${INGEST_NIC_CAPACITY_MBPS} Mbps (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "ingest.disk_full",
        title: "Ingest host disk filling up",
        forTicks: 2,
        warn: DISK_WARN_PCT,
        crit: DISK_CRIT_PCT,
        unit: "%",
        fetch: (ctx) => hostSystemField(ctx, (f) => f.disk_used_pct),
        format: (node, v, t) => `Disk on ${node} at ${v.toFixed(1)}% (warn > ${t.warn}%, crit > ${t.crit}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "ingest.ws_broadcast_down",
        title: "Ingest node WS broadcast link down",
        // ~45s sustained at the 15s tick — rides out the client's normal
        // reconnect backoff (caps at 30s) without flapping.
        forTicks: 3,
        warn: 1,
        direction: "below",
        // The field is 0/1 and only written by nodes that have WS broadcast
        // configured, so absence (old node version / WS disabled) stays quiet.
        tunable: false,
        fetch: (ctx) => hostSystemField(ctx, (f) => f.ws_broadcast_connected),
        format: (node) => `WS broadcast link from ${node} to ws-server is down`,
      },
      overrides,
    ),
    absenceRule(
      {
        id: "ingest.node_silent",
        title: "Ingest node gone silent",
        measurement: "host_system",
        tag: "node_id",
        silentAfterMs: NODE_SILENT_AFTER_MS,
        expected: (ctx) =>
          ctx.registry.ingestNodes
            .filter((n) => n.status === "linked" && !n.maintenance)
            .map((n) => ({ entityId: n.id, label: n.tailscaleIp ? `${n.name} (${n.tailscaleIp})` : n.name })),
      },
      overrides,
    ),
    customRule(
      {
        id: "ingest.stream_stall",
        title: "Ingest stream stalled",
        forTicks: 2,
        envs: ["prod", "staging"],
        async evaluate(ctx) {
          if (ctx.registry.liveIngestSessions.length === 0) return [];
          const activity = await queryIngestStreamActivity("2m", { bucket: ctx.bucket });
          const activeSessionIds = new Set(activity.filter((a) => a.kbps > 0).map((a) => a.sessionId));
          const breaches: Breach[] = [];
          for (const session of ctx.registry.liveIngestSessions) {
            // Skip sessions that just started — first samples may still be in flight.
            if (ctx.now.getTime() - new Date(session.startedAt).getTime() < INGEST_STALL_MIN_SESSION_AGE_MS)
              continue;
            if (activeSessionIds.has(session.sessionId)) continue;
            breaches.push({
              entityId: session.sessionId,
              severity: "crit",
              message: `Session ${session.sessionId} is live in the DB but no bytes are flowing`,
            });
          }
          return breaches;
        },
      },
      overrides,
    ),
  ];
}
