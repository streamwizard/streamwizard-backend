import { NextResponse } from "next/server";

// Pure liveness probe for the monitoring alert-worker — no DB or InfluxDB calls,
// just proof the Next.js server is up and serving requests.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true });
}
