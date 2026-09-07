"use client";

import { useEffect, useState } from "react";
import { EMPTY_CHAT_ASSETS, type ChatAssets } from "@repo/ui/chat";

/**
 * Prefetches the maps chat rendering needs, once.
 *
 * Chat renders immediately with whatever has landed — first-party Twitch emotes
 * need no map at all, and the bot pre-enriches badge URLs onto the events — so a
 * slow or failed prefetch degrades to plain text rather than an empty pane.
 * `version` bumps exactly once when everything settles, so memoized rows
 * re-render one time instead of on every incoming message.
 */

const PROVIDERS = ["7tv", "bttv", "ffz"] as const;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function useChatAssets(enabled: boolean) {
  const [assets, setAssets] = useState<ChatAssets>(EMPTY_CHAT_ASSETS);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled || version > 0) return;
    let cancelled = false;

    (async () => {
      const [badges, cheermotes, ...emoteSets] = await Promise.all([
        fetchJson<{ badges: ChatAssets["badges"] }>("/api/twitch/assets/badges"),
        fetchJson<{ cheermotes: ChatAssets["cheermotes"] }>("/api/twitch/assets/cheermotes"),
        ...PROVIDERS.map((provider) =>
          fetchJson<{ emotes: ChatAssets["thirdPartyEmotes"] }>(
            `/api/twitch/assets/emotes?provider=${provider}`,
          ),
        ),
      ]);

      if (cancelled) return;

      // Later providers win on a code collision, matching how chat clients
      // generally resolve overlapping 7TV/BTTV/FFZ codes.
      const thirdPartyEmotes = Object.assign(
        {},
        ...emoteSets.map((set) => set?.emotes ?? {}),
      ) as ChatAssets["thirdPartyEmotes"];

      setAssets({
        badges: badges?.badges ?? {},
        cheermotes: cheermotes?.cheermotes ?? {},
        thirdPartyEmotes,
      });
      setVersion(1);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, version]);

  return { assets, version };
}
