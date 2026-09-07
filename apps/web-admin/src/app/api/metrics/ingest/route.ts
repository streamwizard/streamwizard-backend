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
import { NextResponse } from "next/server";
import { getRegisteredNodeIds, filterToRegistered, labelNodes } from "@/lib/registry-nodes";
import { getFleet } from "@/lib/node-fleet";
import { mergeIngestNodes } from "@/lib/ingest-nodes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fluxRange = searchParams.get("range") ?? "24h";
  const window = searchParams.get("window") ?? "1h";

  try {
    // Each source is independently fail-soft: one slow/broken query (e.g. the
    // active-signals pivot) must degrade only its own panel, never blank the
    // whole page.
    const [hostCpu, hostMem, hostRx, hostTx, hostDisk, hostSteal, hostLoad, hostTsRx, hostTsTx, hostSnapshot, activeSignals, registeredIds, fleet] =
      await Promise.all([
        queryHostCpu(fluxRange, window).catch(() => []),
        queryHostMemUsed(fluxRange, window).catch(() => []),
        queryHostRxBandwidth(fluxRange, window).catch(() => []),
        queryHostTxBandwidth(fluxRange, window).catch(() => []),
        queryHostDiskUsed(fluxRange, window).catch(() => []),
        queryHostCpuSteal(fluxRange, window).catch(() => []),
        queryHostLoadAvg(fluxRange, window).catch(() => []),
        queryHostTailscaleRx(fluxRange, window).catch(() => []),
        queryHostTailscaleTx(fluxRange, window).catch(() => []),
        queryHostSnapshot().catch(() => []),
        queryActiveIngestSignals().catch(() => []),
        getRegisteredNodeIds("ingest_nodes").catch(() => null),
        getFleet("ingest").catch(() => []),
      ]);

    const nodeNames = new Map(fleet.map((n) => [n.id, n.name]));
    const show = <T extends { nodeId: string }>(points: T[]) =>
      labelNodes(filterToRegistered(points, registeredIds, (p) => p.nodeId), nodeNames);
    return NextResponse.json({
      hostCpu: show(hostCpu),
      hostMem: show(hostMem),
      hostRx: show(hostRx),
      hostTx: show(hostTx),
      hostDisk: show(hostDisk),
      hostSteal: show(hostSteal),
      hostLoad: show(hostLoad),
      hostTsRx: show(hostTsRx),
      hostTsTx: show(hostTsTx),
      ingestNodes: mergeIngestNodes(fleet, hostSnapshot),
      activeSignals,
      fleet,
    });
  } catch (err) {
    console.error("[ingest metrics]", err);
    return NextResponse.json({ hostCpu: [], hostMem: [], hostRx: [], hostTx: [], activeSignals: [] });
  }
}
