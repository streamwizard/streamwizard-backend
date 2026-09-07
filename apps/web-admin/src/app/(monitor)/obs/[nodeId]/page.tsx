import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getNodeAction } from "@/actions/nodes";
import { NodeDetailClient } from "@/components/admin/node-detail-client";
import { NodeMetricChart, type NodeMetricPoint } from "@/components/charts/node-metric-chart";
import { Button } from "@repo/ui";
import {
  queryObsNodeCpu,
  queryObsNodeRam,
  queryObsNodeGpuUtil,
  queryObsNodeEncoderUtil,
  queryObsNodeVram,
  queryObsNodeBandwidth,
} from "@repo/metrics";

export const dynamic = "force-dynamic";

export default async function NodeDetailPage({ params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;

  const { data: node } = await getNodeAction(nodeId);
  if (!node) notFound();

  // History series come from the fleet-wide obs_node measurement; keep only
  // this node's points. The chart's SWR refresh reuses the fleet API payload,
  // where labeling renames nodeId to the node *name* — filter on both.
  const empty: NodeMetricPoint[] = [];
  const only = (points: NodeMetricPoint[]) => points.filter((p) => p.nodeId === node.id);
  const [cpuHist, ramHist, gpuHist, encoderHist, vramHist, rxHist, txHist] = await Promise.all([
    queryObsNodeCpu("24h", "1h").then(only).catch(() => empty),
    queryObsNodeRam("24h", "1h").then(only).catch(() => empty),
    queryObsNodeGpuUtil("24h", "1h").then(only).catch(() => empty),
    queryObsNodeEncoderUtil("24h", "1h").then(only).catch(() => empty),
    queryObsNodeVram("24h", "1h").then(only).catch(() => empty),
    queryObsNodeBandwidth("rx", "24h", "1h").then(only).catch(() => empty),
    queryObsNodeBandwidth("tx", "24h", "1h").then(only).catch(() => empty),
  ]);
  const filterIds = [node.id, node.name];

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/obs">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Nodes
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{node.name}</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">{node.api_url ?? "no API URL set"}</p>
      </div>
      <NodeDetailClient node={node} />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">History</h2>
        <p className="text-sm text-muted-foreground">Range and refresh follow the header controls.</p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <NodeMetricChart title="CPU %" initialData={cpuHist} apiPath="/api/metrics/obs" dataKey="nodeCpu" format="percent" filterNodeIds={filterIds} />
          <NodeMetricChart title="RAM Used (MB)" initialData={ramHist} apiPath="/api/metrics/obs" dataKey="nodeRam" filterNodeIds={filterIds} />
          <NodeMetricChart title="GPU Utilization %" initialData={gpuHist} apiPath="/api/metrics/obs" dataKey="nodeGpu" format="percent" filterNodeIds={filterIds} />
          <NodeMetricChart title="Encoder (NVENC) %" initialData={encoderHist} apiPath="/api/metrics/obs" dataKey="nodeEncoder" format="percent" filterNodeIds={filterIds} />
          <NodeMetricChart title="VRAM Used (MB)" initialData={vramHist} apiPath="/api/metrics/obs" dataKey="nodeVram" filterNodeIds={filterIds} />
          <NodeMetricChart title="Bandwidth In" initialData={rxHist} apiPath="/api/metrics/obs" dataKey="nodeRx" format="bytesPerSec" filterNodeIds={filterIds} />
          <NodeMetricChart title="Bandwidth Out" initialData={txHist} apiPath="/api/metrics/obs" dataKey="nodeTx" format="bytesPerSec" filterNodeIds={filterIds} />
        </div>
      </section>
    </div>
  );
}
