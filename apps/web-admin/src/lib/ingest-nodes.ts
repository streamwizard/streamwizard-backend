import type { HostNodeSnapshot } from "@repo/metrics";
import type { FleetNode } from "./node-fleet";

// One ingest box, everything about it in a single row: registry + live health
// (FleetNode) merged with its latest host_system reading (HostNodeSnapshot).
// Resource fields are null when the node has no recent metrics (offline, or
// Influx unreachable) so the table can render "—" instead of a fake zero.
export interface IngestNode extends FleetNode {
  cpuPct: number | null;
  ramUsedMb: number | null;
  ramTotalMb: number | null;
  diskUsedPct: number | null;
  loadAvg1: number | null;
  rxBytesPerSec: number | null;
  txBytesPerSec: number | null;
}

export function mergeIngestNodes(fleet: FleetNode[], snapshot: HostNodeSnapshot[]): IngestNode[] {
  const byId = new Map(snapshot.map((s) => [s.nodeId, s]));
  return fleet.map((node) => {
    const s = byId.get(node.id);
    return {
      ...node,
      cpuPct: s?.cpuPct ?? null,
      ramUsedMb: s?.ramUsedMb ?? null,
      ramTotalMb: s?.ramTotalMb ?? null,
      diskUsedPct: s?.diskUsedPct ?? null,
      loadAvg1: s?.loadAvg1 ?? null,
      rxBytesPerSec: s?.rxBytesPerSec ?? null,
      txBytesPerSec: s?.txBytesPerSec ?? null,
    };
  });
}
