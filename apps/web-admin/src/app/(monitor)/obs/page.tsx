import {
  queryObsNodeCpu,
  queryObsNodeRam,
  queryObsNodeGpuUtil,
  queryObsNodeEncoderUtil,
  queryObsNodePower,
  queryObsNodeNvencSessions,
  queryObsNodeNvencFps,
  queryObsNodeVram,
  queryObsNodeInstanceCount,
  queryObsNodeBandwidth,
  queryObsNodeSnapshot,
  queryObsInstanceSnapshot,
} from "@repo/metrics";
import type { ObsNodeSnapshot, ObsInstanceSnapshot } from "@repo/metrics";
import type { NodeMetricPoint } from "@/components/charts/node-metric-chart";
import { NodeMetricChart } from "@/components/charts/node-metric-chart";
import { ObsNodeTable } from "@/components/charts/obs-node-table";
import { ObsInstanceTable } from "@/components/charts/obs-instance-table";
import { NodeFleetTable } from "@/components/charts/node-fleet-table";
import { StatCard } from "@/components/widgets/stat-card";
import { getRegisteredNodeIds, filterToRegistered, labelNodes } from "@/lib/registry-nodes";
import { getFleet, type FleetNode } from "@/lib/node-fleet";
import { settled } from "@/lib/settled";
import { listNodesAction } from "@/actions/nodes";
import { checkNodesHealth } from "@/lib/node-health";
import { NodesSection } from "@/components/admin/nodes-section";

export const dynamic = "force-dynamic";

export default async function ObsDashboard() {
  let nodeCpu: NodeMetricPoint[] = [];
  let nodeRam: NodeMetricPoint[] = [];
  let nodeGpu: NodeMetricPoint[] = [];
  let nodeEncoder: NodeMetricPoint[] = [];
  let nodePower: NodeMetricPoint[] = [];
  let nodeNvencSessions: NodeMetricPoint[] = [];
  let nodeNvencFps: NodeMetricPoint[] = [];
  let nodeVram: NodeMetricPoint[] = [];
  let nodeInstanceCount: NodeMetricPoint[] = [];
  let nodeRx: NodeMetricPoint[] = [];
  let nodeTx: NodeMetricPoint[] = [];
  let nodeSnapshot: ObsNodeSnapshot[] = [];
  let instanceSnapshot: ObsInstanceSnapshot[] = [];

  let registeredIds: Set<string> | null = null;
  let fleet: FleetNode[] = [];
  try {
    fleet = await getFleet("obs");
  } catch {
    // registry unreachable — table renders its empty state
  }

  // Management data (registry CRUD + live /health probes) alongside the metrics.
  const { data: managedNodes, error: manageError } = await listNodesAction();
  const healthByNodeId = managedNodes ? await checkNodesHealth(managedNodes) : {};
  const [
    cpuRes,
    ramRes,
    gpuRes,
    encoderRes,
    powerRes,
    nvencSessionsRes,
    nvencFpsRes,
    vramRes,
    instanceCountRes,
    rxRes,
    txRes,
    snapshotRes,
    instanceSnapshotRes,
    registeredIdsRes,
  ] = await Promise.allSettled([
    queryObsNodeCpu("24h", "1h"),
    queryObsNodeRam("24h", "1h"),
    queryObsNodeGpuUtil("24h", "1h"),
    queryObsNodeEncoderUtil("24h", "1h"),
    queryObsNodePower("24h", "1h"),
    queryObsNodeNvencSessions("24h", "1h"),
    queryObsNodeNvencFps("24h", "1h"),
    queryObsNodeVram("24h", "1h"),
    queryObsNodeInstanceCount("24h", "1h"),
    queryObsNodeBandwidth("rx", "24h", "1h"),
    queryObsNodeBandwidth("tx", "24h", "1h"),
    queryObsNodeSnapshot(),
    queryObsInstanceSnapshot(),
    getRegisteredNodeIds("obs_nodes"),
  ]);

  nodeCpu = settled(cpuRes, [], "obs node cpu");
  nodeRam = settled(ramRes, [], "obs node ram");
  nodeGpu = settled(gpuRes, [], "obs node gpu");
  nodeEncoder = settled(encoderRes, [], "obs node encoder");
  nodePower = settled(powerRes, [], "obs node power");
  nodeNvencSessions = settled(nvencSessionsRes, [], "obs node nvenc sessions");
  nodeNvencFps = settled(nvencFpsRes, [], "obs node nvenc fps");
  nodeVram = settled(vramRes, [], "obs node vram");
  nodeInstanceCount = settled(instanceCountRes, [], "obs node instance count");
  nodeRx = settled(rxRes, [], "obs node rx");
  nodeTx = settled(txRes, [], "obs node tx");
  nodeSnapshot = settled(snapshotRes, [], "obs node snapshot");
  instanceSnapshot = settled(instanceSnapshotRes, [], "obs instance snapshot");
  // null (not []) keeps filterToRegistered permissive when the registry is down.
  registeredIds = settled(registeredIdsRes, null, "obs registered ids");

  // Influx keeps points from deleted nodes until they age out of the range;
  // show only nodes that still exist in the registry, labeled by name.
  const nodeNames = new Map(fleet.map((n) => [n.id, n.name]));
  nodeCpu = labelNodes(filterToRegistered(nodeCpu, registeredIds, (p) => p.nodeId), nodeNames);
  nodeRam = labelNodes(filterToRegistered(nodeRam, registeredIds, (p) => p.nodeId), nodeNames);
  nodeGpu = labelNodes(filterToRegistered(nodeGpu, registeredIds, (p) => p.nodeId), nodeNames);
  nodeEncoder = labelNodes(filterToRegistered(nodeEncoder, registeredIds, (p) => p.nodeId), nodeNames);
  nodePower = labelNodes(filterToRegistered(nodePower, registeredIds, (p) => p.nodeId), nodeNames);
  nodeNvencSessions = labelNodes(filterToRegistered(nodeNvencSessions, registeredIds, (p) => p.nodeId), nodeNames);
  nodeNvencFps = labelNodes(filterToRegistered(nodeNvencFps, registeredIds, (p) => p.nodeId), nodeNames);
  nodeVram = labelNodes(filterToRegistered(nodeVram, registeredIds, (p) => p.nodeId), nodeNames);
  nodeInstanceCount = labelNodes(filterToRegistered(nodeInstanceCount, registeredIds, (p) => p.nodeId), nodeNames);
  nodeRx = labelNodes(filterToRegistered(nodeRx, registeredIds, (p) => p.nodeId), nodeNames);
  nodeTx = labelNodes(filterToRegistered(nodeTx, registeredIds, (p) => p.nodeId), nodeNames);
  nodeSnapshot = labelNodes(filterToRegistered(nodeSnapshot, registeredIds, (n) => n.nodeId), nodeNames);
  instanceSnapshot = labelNodes(filterToRegistered(instanceSnapshot, registeredIds, (i) => i.nodeId), nodeNames);

  const totalRunning = nodeSnapshot.reduce((acc, n) => acc + n.runningInstanceCount, 0);
  const totalCapacity = nodeSnapshot.reduce((acc, n) => acc + n.maxInstances, 0);
  const totalVramUsed = nodeSnapshot.reduce((acc, n) => acc + n.vramUsedMb, 0);
  const totalVramCapacity = nodeSnapshot.reduce((acc, n) => acc + n.vramTotalMb, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">OBS Nodes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Range and refresh follow the header controls</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Fleet</h2>
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            title="Nodes"
            value={registeredIds === null ? nodeSnapshot.length : `${nodeSnapshot.length} / ${registeredIds.size}`}
            description={registeredIds === null ? "Reporting host metrics" : "Reporting / registered"}
          />
          <StatCard
            title="Running Instances"
            value={`${totalRunning} / ${totalCapacity}`}
            description="Across all nodes"
          />
          <StatCard
            title="VRAM"
            value={`${totalVramUsed.toFixed(0)} / ${totalVramCapacity.toFixed(0)} MB`}
            description="Used vs total across nodes"
          />
          <StatCard
            title="Utilization"
            value={totalCapacity > 0 ? `${((totalRunning / totalCapacity) * 100).toFixed(0)}%` : "—"}
            description="Instance capacity used"
          />
        </div>
        <NodeFleetTable initialData={fleet} apiPath="/api/metrics/obs" title="Registered Nodes" />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Manage Nodes</h2>
        <NodesSection initialNodes={managedNodes ?? []} error={manageError} healthByNodeId={healthByNodeId} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Host Resources</h2>
        <div className="grid grid-cols-2 gap-4">
          <NodeMetricChart title="CPU %" initialData={nodeCpu} apiPath="/api/metrics/obs" dataKey="nodeCpu" format="percent" />
          <NodeMetricChart title="RAM Used (MB)" initialData={nodeRam} apiPath="/api/metrics/obs" dataKey="nodeRam" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">GPU</h2>
        <div className="grid grid-cols-2 gap-4">
          <NodeMetricChart title="Encoder (NVENC) Utilization %" initialData={nodeEncoder} apiPath="/api/metrics/obs" dataKey="nodeEncoder" format="percent" />
          <NodeMetricChart title="Power Draw (W)" initialData={nodePower} apiPath="/api/metrics/obs" dataKey="nodePower" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <NodeMetricChart title="GPU Utilization % (time occupancy)" initialData={nodeGpu} apiPath="/api/metrics/obs" dataKey="nodeGpu" format="percent" />
          <NodeMetricChart title="VRAM Used (MB)" initialData={nodeVram} apiPath="/api/metrics/obs" dataKey="nodeVram" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <NodeMetricChart title="NVENC Sessions" initialData={nodeNvencSessions} apiPath="/api/metrics/obs" dataKey="nodeNvencSessions" />
          <NodeMetricChart title="NVENC Encode FPS" initialData={nodeNvencFps} apiPath="/api/metrics/obs" dataKey="nodeNvencFps" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Instances & Bandwidth</h2>
        <div className="grid grid-cols-2 gap-4">
          <NodeMetricChart title="Running Instances" initialData={nodeInstanceCount} apiPath="/api/metrics/obs" dataKey="nodeInstanceCount" />
          <NodeMetricChart title="Bandwidth In" initialData={nodeRx} apiPath="/api/metrics/obs" dataKey="nodeRx" format="bytesPerSec" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <NodeMetricChart title="Bandwidth Out" initialData={nodeTx} apiPath="/api/metrics/obs" dataKey="nodeTx" format="bytesPerSec" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Fleet Detail</h2>
        <ObsNodeTable initialData={nodeSnapshot} />
        <ObsInstanceTable initialData={instanceSnapshot} />
      </section>
    </div>
  );
}
