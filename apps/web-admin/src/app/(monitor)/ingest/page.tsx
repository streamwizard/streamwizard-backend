import {
  queryHostCpu,
  queryHostMemUsed,
  queryHostRxBandwidth,
  queryHostTxBandwidth,
  queryHostDiskUsed,
  queryHostCpuSteal,
  queryHostLoadAvg,
  queryHostTailscaleRx,
  queryHostTailscaleTx,
  queryHostSnapshot,
  queryActiveIngestSignals,
} from "@repo/metrics";
import { Server, Radio, Users, ArrowDownToLine, Cpu, Network } from "lucide-react";
import type { ActiveIngestSignal, HostNodeSnapshot } from "@repo/metrics";
import type { NodeMetricPoint } from "@/components/charts/node-metric-chart";
import { NodeMetricChart } from "@/components/charts/node-metric-chart";
import { ActiveSignalsTable } from "@/components/charts/active-signals-table";
import { IngestNodeTable } from "@/components/charts/ingest-node-table";
import { IngestLivePanel } from "@/components/charts/ingest-live-panel";
import { IngestLiveProvider } from "@/lib/ingest-live-context";
import { StatCard } from "@/components/widgets/stat-card";
import { PageHeader } from "@/components/widgets/page-header";
import { SectionHeading } from "@/components/widgets/section-heading";
import { LiveIndicator } from "@/components/widgets/live-indicator";
import { getRegisteredNodeIds, filterToRegistered, labelNodes } from "@/lib/registry-nodes";
import { getFleet, type FleetNode } from "@/lib/node-fleet";
import { mergeIngestNodes } from "@/lib/ingest-nodes";
import { listIngestNodesAction } from "@/actions/ingest-nodes";
import { IngestNodesSection } from "@/components/admin/ingest-nodes-section";

export const dynamic = "force-dynamic";

export default async function IngestDashboard() {
  let hostCpu: NodeMetricPoint[] = [];
  let hostMem: NodeMetricPoint[] = [];
  let hostRx: NodeMetricPoint[] = [];
  let hostTx: NodeMetricPoint[] = [];
  let hostDisk: NodeMetricPoint[] = [];
  let hostSteal: NodeMetricPoint[] = [];
  let hostLoad: NodeMetricPoint[] = [];
  let hostTsRx: NodeMetricPoint[] = [];
  let hostTsTx: NodeMetricPoint[] = [];
  let hostSnapshot: HostNodeSnapshot[] = [];
  let activeSignals: ActiveIngestSignal[] = [];

  let registeredIds: Set<string> | null = null;
  let fleet: FleetNode[] = [];
  try {
    fleet = await getFleet("ingest");
  } catch {
    // registry unreachable — table renders its empty state
  }
  // Fail-soft per source so one broken query can't blank every panel.
  [hostCpu, hostMem, hostRx, hostTx, hostDisk, hostSteal, hostLoad, hostTsRx, hostTsTx, hostSnapshot, activeSignals, registeredIds] =
    await Promise.all([
      queryHostCpu("24h", "1h").catch(() => []),
      queryHostMemUsed("24h", "1h").catch(() => []),
      queryHostRxBandwidth("24h", "1h").catch(() => []),
      queryHostTxBandwidth("24h", "1h").catch(() => []),
      queryHostDiskUsed("24h", "1h").catch(() => []),
      queryHostCpuSteal("24h", "1h").catch(() => []),
      queryHostLoadAvg("24h", "1h").catch(() => []),
      queryHostTailscaleRx("24h", "1h").catch(() => []),
      queryHostTailscaleTx("24h", "1h").catch(() => []),
      queryHostSnapshot().catch(() => []),
      queryActiveIngestSignals().catch(() => []),
      getRegisteredNodeIds("ingest_nodes").catch(() => null),
    ]);

  // Influx keeps points from deleted nodes until they age out of the range;
  // show only nodes that still exist in the registry, labeled by name.
  const nodeNames = new Map(fleet.map((n) => [n.id, n.name]));
  const show = (points: NodeMetricPoint[]) =>
    labelNodes(filterToRegistered(points, registeredIds, (p) => p.nodeId), nodeNames);
  hostCpu = show(hostCpu);
  hostMem = show(hostMem);
  hostRx = show(hostRx);
  hostTx = show(hostTx);
  hostDisk = show(hostDisk);
  hostSteal = show(hostSteal);
  hostLoad = show(hostLoad);
  hostTsRx = show(hostTsRx);
  hostTsTx = show(hostTsTx);

  const nodeCount = new Set(hostCpu.map((p) => p.nodeId)).size;
  const userCount = new Set(activeSignals.map((s) => s.userId)).size;
  const totalKbps = activeSignals.reduce((acc, s) => acc + s.kbps, 0);
  const totalIncoming = totalKbps >= 1000 ? `${(totalKbps / 1000).toFixed(1)} Mbps` : `${totalKbps.toFixed(0)} kbps`;

  // Node health drives the card colour: green when every registered node is
  // reporting, amber when some are silent, red when nothing is reporting.
  const registeredCount = registeredIds?.size ?? null;
  const nodesTone = nodeCount === 0 ? "danger" : registeredCount !== null && nodeCount < registeredCount ? "warning" : "positive";

  // Registry + health + latest resource snapshot, one row per node.
  const ingestNodes = mergeIngestNodes(fleet, hostSnapshot);

  // Management data (registry CRUD) alongside the metrics.
  const { data: managedNodes, error: manageError } = await listIngestNodesAction();

  return (
    // One shared monitor WebSocket for every live consumer below (realtime
    // panel + the Registered Nodes table's network column).
    <IngestLiveProvider
      wsUrl={process.env.NEXT_PUBLIC_WS_SERVER_URL ?? null}
      monitorSecret={process.env.NEXT_PUBLIC_MONITOR_SECRET ?? null}
    >
    <div className="space-y-8">
      <PageHeader title="Ingest Servers" description="Real-time health of the ingest fleet">
        <LiveIndicator />
      </PageHeader>

      <section className="space-y-3">
        <SectionHeading icon={Server}>Fleet</SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Ingest Nodes"
            value={registeredIds === null ? nodeCount : `${nodeCount} / ${registeredIds.size}`}
            description={registeredIds === null ? "Reporting host metrics" : "Reporting / registered"}
            tone={nodesTone}
            icon={Server}
          />
          <StatCard title="Active Signals" value={activeSignals.length} description="Incoming streams right now" icon={Radio} />
          <StatCard title="Streaming Users" value={userCount} description="Distinct users currently live" icon={Users} />
          <StatCard title="Total Incoming" value={totalIncoming} description="Sum across active signals" icon={ArrowDownToLine} />
        </div>
        <IngestNodeTable initialData={ingestNodes} title="Registered Nodes" />
      </section>

      <section className="space-y-3">
        <SectionHeading icon={Server}>Manage Nodes</SectionHeading>
        <IngestNodesSection initialNodes={managedNodes ?? []} error={manageError} />
      </section>

      <section className="space-y-3">
        <SectionHeading icon={Network}>Realtime Network</SectionHeading>
        {/* WS-fed, network-only: fleet/per-node NIC bandwidth + per-stream
            transport health. cpu/ram/disk stay on the InfluxDB charts below. */}
        <IngestLivePanel />
      </section>

      <section className="space-y-3">
        <SectionHeading icon={Cpu}>Host Resources</SectionHeading>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <NodeMetricChart title="CPU %" initialData={hostCpu} apiPath="/api/metrics/ingest" dataKey="hostCpu" format="percent" />
          <NodeMetricChart title="CPU Steal %" initialData={hostSteal} apiPath="/api/metrics/ingest" dataKey="hostSteal" format="percent" />
          <NodeMetricChart title="RAM Used (MB)" initialData={hostMem} apiPath="/api/metrics/ingest" dataKey="hostMem" />
          <NodeMetricChart title="Disk Used %" initialData={hostDisk} apiPath="/api/metrics/ingest" dataKey="hostDisk" format="percent" />
          <NodeMetricChart title="Load Avg (1m)" initialData={hostLoad} apiPath="/api/metrics/ingest" dataKey="hostLoad" />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading icon={Network}>Bandwidth</SectionHeading>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <NodeMetricChart title="Incoming" initialData={hostRx} apiPath="/api/metrics/ingest" dataKey="hostRx" format="bytesPerSec" />
          <NodeMetricChart title="Outgoing" initialData={hostTx} apiPath="/api/metrics/ingest" dataKey="hostTx" format="bytesPerSec" />
          <NodeMetricChart title="Tailscale In" initialData={hostTsRx} apiPath="/api/metrics/ingest" dataKey="hostTsRx" format="bytesPerSec" />
          <NodeMetricChart title="Tailscale Out" initialData={hostTsTx} apiPath="/api/metrics/ingest" dataKey="hostTsTx" format="bytesPerSec" />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading icon={Radio}>Signals by User</SectionHeading>
        <ActiveSignalsTable initialData={activeSignals} />
      </section>
    </div>
    </IngestLiveProvider>
  );
}
