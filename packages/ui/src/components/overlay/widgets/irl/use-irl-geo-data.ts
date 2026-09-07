"use client";

// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

import { useEffect, useState } from "react";
import type { GeoPayload } from "../../types";
import { subscribeToWsRoom } from "../../lib/ws-store";

export type IrlConnectionStatus = "connecting" | "connected" | "offline" | "disconnected";

// The geo frame nests its status discriminant inside `payload` -- ws-server
// broadcasts the whole {status, payload} envelope as the message payload.
type IrlMessage =
  | { type: "ws:open" }
  | { type: "ws:close" }
  | {
      type: "streamwizard.geo";
      payload: { status: "connected"; payload: GeoPayload } | { status: "offline" };
    };

const MOCK_GEO: GeoPayload = {
  latitude: 52.37403,
  longitude: 4.88969,
  altitude: 14,
  speed: 11.2,
  heading: 247,
  accuracy: 5,
  timestamp: Date.now(),
};

export function useIrlGeoData(
  subscriberToken: string,
  mockData: boolean
): { geo: GeoPayload | null; status: IrlConnectionStatus } {
  const [state, setState] = useState<{ geo: GeoPayload | null; status: IrlConnectionStatus }>(() => ({
    geo: mockData ? MOCK_GEO : null,
    status: mockData ? "connected" : "connecting",
  }));

  useEffect(() => {
    if (mockData) {
      setState({ geo: MOCK_GEO, status: "connected" });
      return;
    }
    if (!subscriberToken) {
      setState({ geo: null, status: "connecting" });
      return;
    }
    const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? "ws://localhost:3009";
    return subscribeToWsRoom(subscriberToken, wsUrl, (raw) => {
      const msg = raw as IrlMessage;
      if (msg.type === "ws:open") {
        setState((s) => ({ ...s, status: "connected" }));
      } else if (msg.type === "ws:close") {
        setState((s) => ({ ...s, status: "disconnected" }));
      } else if (msg.type === "streamwizard.geo") {
        const geoEvent = msg.payload;
        if (!geoEvent || geoEvent.status === "offline") {
          setState((s) => ({ ...s, status: "offline" }));
        } else {
          setState({ geo: geoEvent.payload, status: "connected" });
        }
      }
    });
  }, [subscriberToken, mockData]);

  return state;
}
