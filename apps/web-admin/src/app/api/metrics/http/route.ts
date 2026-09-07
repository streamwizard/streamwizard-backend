import { queryHttpRequests, queryHttpRouteStats } from "@repo/metrics";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fluxRange = searchParams.get("range") ?? "24h";
  const window = searchParams.get("window") ?? "1h";

  try {
    const [requests, routeStats] = await Promise.all([
      queryHttpRequests(fluxRange, window),
      queryHttpRouteStats(fluxRange),
    ]);
    return NextResponse.json({ requests, routeStats });
  } catch (err) {
    console.error("[http metrics]", err);
    return NextResponse.json({ requests: [], routeStats: [] });
  }
}
