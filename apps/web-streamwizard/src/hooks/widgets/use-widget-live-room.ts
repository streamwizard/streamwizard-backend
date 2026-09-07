"use client";

import { useMemo, useState } from "react";
import { supabase } from "@repo/supabase/next/client";
import type { WsRoomOptions, WsRoomStatus } from "@repo/ui/overlay";
import { useSession } from "@/providers/session-provider";
import { env } from "@/lib/env";

/**
 * Optional live Twitch events in the preview: the editor subscribes to the
 * signed-in user's own ws-server room.
 *
 * No scene is involved — ws-server's subscriber path accepts a Supabase JWT
 * directly, same as the IRL dashboard widgets. The token is resolved per
 * connect so a refreshed session reuses the same room.
 */
export function useWidgetLiveRoom() {
  const user = useSession();
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<WsRoomStatus>("disconnected");

  const room = useMemo<WsRoomOptions | undefined>(() => {
    if (!enabled) return undefined;
    return {
      roomKey: `dashboard:${user.id}`,
      wsUrl: env.NEXT_PUBLIC_WS_SERVER_URL,
      getToken: async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? "";
      },
    };
  }, [enabled, user.id]);

  return { enabled, toggle: () => setEnabled((v) => !v), status, setStatus, room };
}
