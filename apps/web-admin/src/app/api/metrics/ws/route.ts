import {
  queryWsConnections,
  queryWsMessages,
  queryWsAuthFailures,
  queryWsDroppedMessages,
  queryWsConnectionDuration,
  queryWsRoomEvents,
  queryWsActiveConnectionsEstimate,
  queryWsTopMessageTypes,
} from "@repo/metrics";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fluxRange = searchParams.get("range") ?? "24h";
  const window = searchParams.get("window") ?? "1h";

  try {
    const [
      connections,
      messages,
      authFailures,
      droppedMessages,
      connectionDuration,
      roomEvents,
      activeConnections,
      topMessageTypes,
    ] = await Promise.all([
      queryWsConnections(fluxRange, window),
      queryWsMessages(fluxRange, window),
      queryWsAuthFailures(fluxRange, window),
      queryWsDroppedMessages(fluxRange, window),
      queryWsConnectionDuration(fluxRange, window),
      queryWsRoomEvents(fluxRange, window),
      queryWsActiveConnectionsEstimate(),
      queryWsTopMessageTypes(fluxRange),
    ]);

    return NextResponse.json({
      connections,
      messages,
      authFailures,
      droppedMessages,
      connectionDuration,
      roomEvents,
      activeConnections,
      topMessageTypes,
    });
  } catch (err) {
    console.error("[ws metrics]", err);
    return NextResponse.json({
      connections: [],
      messages: [],
      authFailures: [],
      droppedMessages: [],
      connectionDuration: [],
      roomEvents: [],
      activeConnections: [],
      topMessageTypes: [],
    });
  }
}
