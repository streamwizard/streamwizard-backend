"use client";

import { useEffect, useRef, useState } from "react";
import type { AutoSwitcherStatus } from "@repo/schemas";
import { supabase } from "@repo/supabase/next/client";
import { env } from "@/lib/env";

// The engine heartbeats every 5s while a stream is being watched; if we go
// this long without one, treat the status as stale rather than showing a
// frozen "live" badge.
const STALE_MS = 15_000;

export function useAutoSwitcherStatus(): { status: AutoSwitcherStatus | null; connected: boolean } {
  const [status, setStatus] = useState<AutoSwitcherStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token || cancelled) return;

      ws = new WebSocket(
        `${env.NEXT_PUBLIC_WS_SERVER_URL}/ws?role=subscriber&token=${encodeURIComponent(token)}&channels=streamwizard.auto_switcher_status`,
      );
      ws.onopen = () => setConnected(true);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; payload: AutoSwitcherStatus };
          if (msg.type !== "streamwizard.auto_switcher_status") return;
          setStatus(msg.payload);
          if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
          staleTimerRef.current = setTimeout(() => setStatus(null), STALE_MS);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => setConnected(false);
      ws.onerror = () => ws?.close();
    })();

    return () => {
      cancelled = true;
      ws?.close();
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
    };
  }, []);

  return { status, connected };
}
