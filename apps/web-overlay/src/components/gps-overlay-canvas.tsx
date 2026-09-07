"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { env } from "@/lib/env";
import { OverlaySceneCanvas, overlayItemFromDbRow } from "@repo/ui/overlay";
import { IrlGeoProvider } from "@repo/ui/components/overlay/hooks/use-irl-geo-context";
import { ClipsWidgetContainer } from "@/components/widgets/clips-widget/ClipsWidgetContainer";
import { CustomWidgetContainer } from "@/components/widgets/custom-widget/CustomWidgetContainer";

const OVERLAY_WIDGETS = [
  { id: "clips_widget", Component: ClipsWidgetContainer },
  { id: "custom_widget", Component: CustomWidgetContainer },
];
import type { OverlayItemRow, OverlaySceneRow } from "@/types/overlays";

interface GeoPayload {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number;
  timestamp: number;
}

export function GpsOverlayCanvas({
  scene,
  items,
  token,
}: {
  scene: OverlaySceneRow;
  items: OverlayItemRow[];
  /** The scene's subscriber_token — authenticates this page as the WS publisher so geo reaches the DB log and other viewers. */
  token: string;
}) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(1000);
  const watchIdRef = useRef<number | null>(null);
  const latestGeoRef = useRef<GeoPayload | null>(null);

  const [geo, setGeo] = useState<GeoPayload | null>(null);

  const overlayItems = useMemo(() => items.map(overlayItemFromDbRow), [items]);

  useEffect(() => {
    function connect() {
      if (!token) return;
      const ws = new WebSocket(
        `${env.NEXT_PUBLIC_WS_SERVER_URL}/ws?role=publisher&token=${encodeURIComponent(token)}`
      );
      wsRef.current = ws;
      ws.onopen = () => {
        retryDelay.current = 1000;
        if (latestGeoRef.current) {
          ws.send(JSON.stringify({ type: "geo", payload: latestGeoRef.current }));
        }
      };
      ws.onclose = () => {
        const delay = retryDelay.current;
        retryDelay.current = Math.min(delay * 2, 30_000);
        retryRef.current = setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const payload: GeoPayload = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        latestGeoRef.current = payload;
        setGeo(payload);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "geo", payload }));
        }
      },
      (err) => console.warn("[geolocation]", err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
    );

    connect();

    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current);
      wsRef.current?.close();
    };
  }, [token]);

  return (
    <IrlGeoProvider geo={geo}>
      <OverlaySceneCanvas scene={scene} items={overlayItems} widgets={OVERLAY_WIDGETS} />
    </IrlGeoProvider>
  );
}
