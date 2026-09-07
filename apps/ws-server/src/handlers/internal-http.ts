import { timingSafeEqual } from "crypto";
import { env } from "../lib/env";
import { supabase } from "@repo/supabase";
import { getLiveStreamIdByBroadcasterId } from "@repo/supabase/queries/live-status";
import { getTwitchIntegrationByBroadcasterId, getTwitchUserIdByUserIdMaybe } from "@repo/supabase/queries/user";
import type { BotBroadcastMessage } from "@repo/types";
import { trackWsAuthFailure } from "@repo/metrics";
import { rooms } from "../rooms";
import { routeBotBroadcast } from "../bot-router";

/**
 * The plain-HTTP surface of ws-server: a liveness probe plus two secret-gated
 * injection points for processes that hold no bot socket (the Next apps and
 * rest-api). Everything else on this server is a WebSocket upgrade.
 */

export function isValidSecret(candidate: string | null | undefined, secret: string): boolean {
  const candidateBuf = Buffer.from(candidate ?? "");
  const secretBuf = Buffer.from(secret);
  return candidateBuf.length === secretBuf.length && timingSafeEqual(candidateBuf, secretBuf);
}

// Server-to-server injection of a bot-shaped broadcast over plain HTTP —
// lets web server actions push config/override changes to the consumer feed
// (and the user's room) with a fetch instead of a WS handshake.
export async function handleInternalBroadcast(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (!env.CONSUMER_SECRET) {
    return new Response("Not Found", { status: 404 });
  }
  const key = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!isValidSecret(key, env.CONSUMER_SECRET)) {
    trackWsAuthFailure("bot", "invalid_bot_key");
    return new Response("Unauthorized", { status: 401 });
  }

  let msg: BotBroadcastMessage;
  try {
    msg = (await req.json()) as BotBroadcastMessage;
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }
  if (typeof msg.userId !== "string" || msg.userId.length === 0 || typeof msg.type !== "string" || msg.type.length === 0) {
    return new Response("Bad Request: userId and type are required", { status: 400 });
  }

  const { delivered } = routeBotBroadcast(msg, "internal-http");
  return Response.json({ ok: true, delivered });
}

// Server-to-server stream_id push from the rest-api EventSub handlers.
// A room resolves stream_id once, at publisher upgrade — so a GPS overlay
// opened before the stream goes live would log its whole walk with
// stream_id=null. stream.online/offline pushes here so a long-lived room
// picks up the id (or drops it) without the phone reconnecting.
export async function handleInternalStreamStatus(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (!env.CONSUMER_SECRET) {
    return new Response("Not Found", { status: 404 });
  }
  const key = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!isValidSecret(key, env.CONSUMER_SECRET)) {
    trackWsAuthFailure("bot", "invalid_bot_key");
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { broadcasterId?: unknown; streamId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }

  const broadcasterId = body.broadcasterId;
  const streamId = body.streamId ?? null;
  if (typeof broadcasterId !== "string" || broadcasterId.length === 0) {
    return new Response("Bad Request: broadcasterId is required", { status: 400 });
  }
  if (streamId !== null && typeof streamId !== "string") {
    return new Response("Bad Request: streamId must be a string or null", { status: 400 });
  }

  const { data: integration } = await getTwitchIntegrationByBroadcasterId(supabase, broadcasterId);
  if (!integration) {
    // Not every broadcaster we get EventSub for has a live room here.
    return Response.json({ ok: true, updated: false });
  }

  const room = rooms.get(integration.user_id);
  if (!room) return Response.json({ ok: true, updated: false });

  room.stream_id = streamId;
  console.log(`[stream-status] room=${integration.user_id} stream=${streamId ?? "none"}`);
  return Response.json({ ok: true, updated: true });
}


export async function findCurrentStreamId(userId: string): Promise<string | null> {
  try {
    const twitchUserId = await getTwitchUserIdByUserIdMaybe(supabase, userId);
    if (!twitchUserId) return null;
    return await getLiveStreamIdByBroadcasterId(supabase, twitchUserId);
  } catch {
    return null;
  }
}

export function handleInternalRoute(req: Request, pathname: string): Promise<Response> | Response | null {
  if (pathname === "/health") return Response.json({ ok: true });
  if (pathname === "/internal/broadcast") return handleInternalBroadcast(req);
  if (pathname === "/internal/stream-status") return handleInternalStreamStatus(req);
  return null;
}
