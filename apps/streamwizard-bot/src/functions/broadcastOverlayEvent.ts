import type { OverlayEventType } from "@repo/types";
import { overlayWsClient } from "../overlay-ws-client";
import { enrichOverlayEvent } from "./enrichOverlayEvent";
import { resolveUserId } from "./resolveUserId";

export async function broadcastOverlayEvent(
  broadcasterId: string,
  type: OverlayEventType,
  payload: unknown
): Promise<void> {
  const userId = await resolveUserId(broadcasterId);
  if (!userId) return;

  // Adds badge image URLs and the subject's avatar when they're already
  // cached. Cache-only and additive, so this never reaches Helix and never
  // changes a field a widget already reads. It can await a cache read, but
  // only within its own short budget.
  overlayWsClient.send({
    userId,
    type,
    payload: await enrichOverlayEvent(broadcasterId, type, payload),
  });
}
