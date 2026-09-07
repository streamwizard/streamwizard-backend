import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getNodeAction, getInstanceAction } from "@/actions/nodes";
import { getAutoSwitcherConfigForUser } from "@/actions/auto-switcher";
import { InstanceDetailClient } from "@/components/admin/instance-detail-client";
import { InstanceSwitcherTab } from "@/components/admin/instance-switcher-tab";
import { NodeMetricChart, type NodeMetricPoint } from "@/components/charts/node-metric-chart";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import {
  queryObsInstanceCpu,
  queryObsInstanceRam,
  queryObsInstanceVram,
  queryObsInstanceRx,
  queryObsInstanceTx,
  queryIngestAvSkew,
  queryIngestAvSkewRaw,
  queryIngestAudioPesInterval,
  queryIngestAvSkewSamples,
  type ObsInstanceMetricPoint,
  type IngestSignalMetricPoint,
} from "@repo/metrics";

export const dynamic = "force-dynamic";

function toNodePoints(points: ObsInstanceMetricPoint[]): NodeMetricPoint[] {
  return points.map((p) => ({ time: p.time, nodeId: "instance", value: p.value }));
}

// Unlike the container metrics, A/V sync is per incoming signal — a user
// streaming two cameras gets two lines — so the stream key stays the series key.
function toSignalPoints(points: IngestSignalMetricPoint[]): NodeMetricPoint[] {
  return points.map((p) => ({ time: p.time, nodeId: p.streamKeyId, value: p.value }));
}

export default async function InstanceDetailPage({
  params,
}: {
  params: Promise<{ nodeId: string; instanceId: string }>;
}) {
  const { nodeId, instanceId } = await params;

  const [{ data: node }, { data: instance }] = await Promise.all([getNodeAction(nodeId), getInstanceAction(instanceId)]);
  if (!node || !instance || instance.node_id !== nodeId) notFound();

  const apiPath = `/api/metrics/obs-instance/${instance.id}`;
  const empty: ObsInstanceMetricPoint[] = [];
  const emptySignal: IngestSignalMetricPoint[] = [];
  const [switcherConfig, cpuHist, ramHist, vramHist, rxHist, txHist, skewHist, skewRawHist, pesHist, samplesHist] =
    await Promise.all([
      getAutoSwitcherConfigForUser(instance.user_id),
      queryObsInstanceCpu(instance.id, "24h", "1h").catch(() => empty),
      queryObsInstanceRam(instance.id, "24h", "1h").catch(() => empty),
      queryObsInstanceVram(instance.id, "24h", "1h").catch(() => empty),
      queryObsInstanceRx(instance.id, "24h", "1h").catch(() => empty),
      queryObsInstanceTx(instance.id, "24h", "1h").catch(() => empty),
      // Keyed by the owner, not the container: the skew is a property of what
      // the streamer's encoder sent, measured on the ingest relay.
      queryIngestAvSkew(instance.user_id, "24h", "1h").catch(() => emptySignal),
      queryIngestAvSkewRaw(instance.user_id, "24h", "1h").catch(() => emptySignal),
      queryIngestAudioPesInterval(instance.user_id, "24h", "1h").catch(() => emptySignal),
      queryIngestAvSkewSamples(instance.user_id, "24h", "1h").catch(() => emptySignal),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href={`/obs/${nodeId}`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {node.name}
          </Link>
        </Button>
        <h1 className="text-2xl font-bold font-mono">{instance.container_name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{instance.owner_name ?? instance.owner_email ?? instance.user_id}</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics history</TabsTrigger>
          <TabsTrigger value="avsync">A/V sync</TabsTrigger>
          <TabsTrigger value="switcher">Auto Switcher</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <InstanceDetailClient node={node} instance={instance} />
        </TabsContent>

        <TabsContent value="metrics" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">Range and refresh follow the header controls.</p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <NodeMetricChart title="CPU %" initialData={toNodePoints(cpuHist)} apiPath={apiPath} dataKey="instanceCpu" format="percent" />
            <NodeMetricChart title="RAM Used (MB)" initialData={toNodePoints(ramHist)} apiPath={apiPath} dataKey="instanceRam" />
            <NodeMetricChart title="VRAM Used (MB)" initialData={toNodePoints(vramHist)} apiPath={apiPath} dataKey="instanceVram" />
            <NodeMetricChart title="Bandwidth In" initialData={toNodePoints(rxHist)} apiPath={apiPath} dataKey="instanceRx" format="bytesPerSec" />
            <NodeMetricChart title="Bandwidth Out" initialData={toNodePoints(txHist)} apiPath={apiPath} dataKey="instanceTx" format="bytesPerSec" />
          </div>
        </TabsContent>

        <TabsContent value="avsync" className="mt-4 space-y-4">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              Read off the PES timestamps of the MPEG-TS this user’s encoder sent, on the ingest relay — not from
              OBS. Positive skew means audio is <strong>behind</strong> video. One line per stream key (“camera”).
            </p>
            <p>
              This is the owner’s ingest signal, so it covers whatever they were streaming in the range, whether or not
              this instance was pulling it. It compares the two streams’ timestamps: an encoder that stamps both
              correctly but captured audio late reads zero here and still sounds out of sync.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <NodeMetricChart
              title="A/V skew (audio behind video)"
              initialData={toSignalPoints(skewHist)}
              apiPath={apiPath}
              dataKey="avSkew"
              format="ms"
              zeroLine
            />
            <NodeMetricChart
              title="Audio PES interval"
              initialData={toSignalPoints(pesHist)}
              apiPath={apiPath}
              dataKey="avPesInterval"
              format="ms"
            />
            <NodeMetricChart
              title="Raw PES gap (uncorrected)"
              initialData={toSignalPoints(skewRawHist)}
              apiPath={apiPath}
              dataKey="avSkewRaw"
              format="ms"
              zeroLine
            />
            <NodeMetricChart
              title="PES samples per report"
              initialData={toSignalPoints(samplesHist)}
              apiPath={apiPath}
              dataKey="avSkewSamples"
            />
          </div>
        </TabsContent>

        <TabsContent value="switcher" className="mt-4">
          <InstanceSwitcherTab
            userId={instance.user_id}
            instanceId={instance.id}
            apiUrl={node.api_url}
            instanceRunning={instance.status === "running"}
            initialConfig={switcherConfig}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
