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
} from "@repo/metrics";
import type { ObsInstanceMetricPoint, IngestSignalMetricPoint } from "@repo/metrics";
import { NextResponse } from "next/server";
import { getInstanceByIdWithOwner } from "@repo/supabase/queries/obs-nodes";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { assertAdmin } from "@/lib/assert-admin";
import { settled } from "@/lib/settled";

export const dynamic = "force-dynamic";

// The charts consume { time, nodeId, value } — for a single-instance page the
// series key is cosmetic, so points are relabeled to one stable key.
function toNodePoints(points: ObsInstanceMetricPoint[], label: string) {
  return points.map((p) => ({ time: p.time, nodeId: label, value: p.value }));
}

// A/V sync comes from the ingest plane, where one user can have several signals
// ("cameras") live at once, so the stream key stays the series key here rather
// than collapsing to a single line.
function toSignalPoints(points: IngestSignalMetricPoint[]) {
  return points.map((p) => ({ time: p.time, nodeId: p.streamKeyId, value: p.value }));
}

export async function GET(request: Request, { params }: { params: Promise<{ instanceId: string }> }) {
  // The (monitor) layout gates the pages, but a route handler runs no layout
  // and proxy.ts only guards /dashboard-style prefixes — so this endpoint has
  // to check for itself before returning another customer's telemetry.
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { instanceId } = await params;
  const { searchParams } = new URL(request.url);
  const fluxRange = searchParams.get("range") ?? "24h";
  const window = searchParams.get("window") ?? "1h";

  // A/V sync is tagged by the streamer, not by the container, so the owner has
  // to be resolved before those series can be queried.
  const instance = await getInstanceByIdWithOwner(supabaseAdmin, instanceId).catch(() => null);
  const userId = instance?.user_id;

  const [cpuRes, ramRes, vramRes, rxRes, txRes, skewRes, skewRawRes, pesRes, samplesRes] = await Promise.allSettled([
    queryObsInstanceCpu(instanceId, fluxRange, window),
    queryObsInstanceRam(instanceId, fluxRange, window),
    queryObsInstanceVram(instanceId, fluxRange, window),
    queryObsInstanceRx(instanceId, fluxRange, window),
    queryObsInstanceTx(instanceId, fluxRange, window),
    userId ? queryIngestAvSkew(userId, fluxRange, window) : Promise.resolve([]),
    userId ? queryIngestAvSkewRaw(userId, fluxRange, window) : Promise.resolve([]),
    userId ? queryIngestAudioPesInterval(userId, fluxRange, window) : Promise.resolve([]),
    userId ? queryIngestAvSkewSamples(userId, fluxRange, window) : Promise.resolve([]),
  ]);

  const label = "instance";
  return NextResponse.json({
    instanceCpu: toNodePoints(settled(cpuRes, [], "obs instance cpu"), label),
    instanceRam: toNodePoints(settled(ramRes, [], "obs instance ram"), label),
    instanceVram: toNodePoints(settled(vramRes, [], "obs instance vram"), label),
    instanceRx: toNodePoints(settled(rxRes, [], "obs instance rx"), label),
    instanceTx: toNodePoints(settled(txRes, [], "obs instance tx"), label),
    avSkew: toSignalPoints(settled(skewRes, [], "ingest av skew")),
    avSkewRaw: toSignalPoints(settled(skewRawRes, [], "ingest av skew raw")),
    avPesInterval: toSignalPoints(settled(pesRes, [], "ingest audio pes interval")),
    avSkewSamples: toSignalPoints(settled(samplesRes, [], "ingest av skew samples")),
  });
}
