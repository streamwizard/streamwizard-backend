"use client";

import { useEffect, useRef } from "react";
import type { ObsInstanceLifecyclePayload } from "@repo/types";
import { supabase } from "@repo/supabase/next/client";
import { env } from "@/lib/env";

// Subscribes to the owning user's ws-server room for OBS container lifecycle
// events (start/stop/delete/crash) pushed by the obs-instance-manager. The
// room is scoped to the user by their Supabase JWT, so there's no userId to
// pass -- the token determines which room this socket joins.
//
// Delivered via callback (not state): consumers react with imperative
// side-effects (obs.reconnect()/disconnect(), hydrating a new instance) that
// don't map cleanly onto a rendered value. onEvent is kept in a ref so the
// socket effect can stay mounted for the page's lifetime while always calling
// the latest closure.
export function useObsInstanceLifecycle(onEvent: (payload: ObsInstanceLifecyclePayload) => void): void {
  const onEventRef = useRef(onEvent);

  // Written after commit, not during render: a render that React throws away
  // would otherwise leave the socket calling a closure that never shipped.
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token || cancelled) return;

      ws = new WebSocket(
        `${env.NEXT_PUBLIC_WS_SERVER_URL}/ws?role=subscriber&token=${encodeURIComponent(token)}&channels=streamwizard.obs_instance_lifecycle`,
      );
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            payload: ObsInstanceLifecyclePayload;
          };
          if (msg.type !== "streamwizard.obs_instance_lifecycle") return;
          onEventRef.current(msg.payload);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onerror = () => ws?.close();
    })();

    return () => {
      cancelled = true;
      ws?.close();
    };
  }, []);
}
