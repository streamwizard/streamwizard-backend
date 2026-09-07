import {
  querySupabaseDbCpuPct,
  querySupabaseDbMemoryPct,
  querySupabaseDbDiskPct,
  querySupabaseDbConnections,
  querySupabaseDbCacheHitPct,
  querySupabaseDbSizes,
  querySupabasePlatformSnapshot,
  querySupabaseMeanQueryMs,
  querySupabaseQueryRate,
  querySupabaseAuthApiMs,
} from "@repo/metrics";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fluxRange = searchParams.get("range") ?? "24h";
  const window = searchParams.get("window") ?? "1h";

  try {
    const [cpu, memory, disk, connections, cacheHit, meanQueryMs, queryRate, authApiMs, sizes, snapshot] =
      await Promise.all([
        querySupabaseDbCpuPct(fluxRange, window),
        querySupabaseDbMemoryPct(fluxRange, window),
        querySupabaseDbDiskPct(fluxRange, window),
        querySupabaseDbConnections(fluxRange, window),
        querySupabaseDbCacheHitPct(fluxRange, window),
        querySupabaseMeanQueryMs(fluxRange, window),
        querySupabaseQueryRate(fluxRange, window),
        querySupabaseAuthApiMs(fluxRange, window),
        querySupabaseDbSizes(),
        querySupabasePlatformSnapshot(),
      ]);

    return NextResponse.json({
      cpu,
      memory,
      disk,
      connections,
      cacheHit,
      meanQueryMs,
      queryRate,
      authApiMs,
      sizes,
      snapshot,
    });
  } catch (err) {
    console.error("[supabase metrics]", err);
    return NextResponse.json({
      cpu: [],
      memory: [],
      disk: [],
      connections: [],
      cacheHit: [],
      meanQueryMs: [],
      queryRate: [],
      authApiMs: [],
      sizes: [],
      snapshot: null,
    });
  }
}
