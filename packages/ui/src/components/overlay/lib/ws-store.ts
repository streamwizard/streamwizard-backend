// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

export type WsEventListener = (msg: unknown) => void;

export type WsRoomStatus = "connecting" | "connected" | "disconnected";

export interface WsRoomOptions {
  /** Stable identity for the socket. Subscribers sharing a key share one connection. */
  roomKey: string;
  wsUrl: string;
  /**
   * Resolved on every (re)connect rather than captured once, so a refreshed
   * Supabase JWT reconnects into the same room instead of forking a new one.
   */
  getToken: () => string | Promise<string>;
  /**
   * Event types this connection wants. Omitted or empty means every event in
   * the room, which is what overlays want — a filter only pays off for a
   * consumer like the deck's chat tab that ignores most of the room's traffic.
   */
  channels?: string[];
}

interface RoomState {
  ws: WebSocket | null;
  listeners: Set<WsEventListener>;
  retryTimer: ReturnType<typeof setTimeout> | null;
  retryDelay: number;
  opts: WsRoomOptions;
}

const rooms = new Map<string, RoomState>();

function broadcast(room: RoomState, msg: unknown) {
  for (const listener of room.listeners) {
    listener(msg);
  }
}

/** True while `room` is still the live entry for `roomKey` — false after teardown. */
function isCurrent(roomKey: string, room: RoomState) {
  return rooms.get(roomKey) === room;
}

function scheduleRetry(roomKey: string, room: RoomState) {
  if (!isCurrent(roomKey, room)) return;
  const delay = Math.min(room.retryDelay, 30000);
  room.retryDelay = Math.min(delay * 2, 30000);
  room.retryTimer = setTimeout(() => connect(roomKey, room), delay);
}

async function connect(roomKey: string, room: RoomState) {
  broadcast(room, { type: "ws:connecting" });

  let token = "";
  try {
    token = await room.opts.getToken();
  } catch {
    token = "";
  }
  // The room can be torn down while the token resolves.
  if (!isCurrent(roomKey, room)) return;
  if (!token) {
    broadcast(room, { type: "ws:close" });
    scheduleRetry(roomKey, room);
    return;
  }

  const channels = room.opts.channels?.length
    ? `&channels=${encodeURIComponent(room.opts.channels.join(","))}`
    : "";

  const ws = new WebSocket(
    `${room.opts.wsUrl}/ws?role=subscriber&token=${encodeURIComponent(token)}${channels}`
  );
  room.ws = ws;

  ws.onopen = () => {
    room.retryDelay = 1000;
    broadcast(room, { type: "ws:open" });
  };

  ws.onmessage = (event) => {
    try {
      broadcast(room, JSON.parse(event.data as string));
    } catch {
      // ignore malformed messages
    }
  };

  ws.onclose = () => {
    if (!isCurrent(roomKey, room)) return; // already cleaned up
    room.ws = null;
    broadcast(room, { type: "ws:close" });
    scheduleRetry(roomKey, room);
  };

  ws.onerror = () => ws.close();
}

/**
 * Subscribers sharing a `roomKey` share one socket, so the first caller's
 * `channels` filter is the one that takes effect. Give a consumer with its own
 * filter its own key.
 */
export function subscribeToWsRoomWith(
  opts: WsRoomOptions,
  listener: WsEventListener
): () => void {
  let room = rooms.get(opts.roomKey);
  if (!room) {
    room = { ws: null, listeners: new Set(), retryTimer: null, retryDelay: 1000, opts };
    rooms.set(opts.roomKey, room);
    room.listeners.add(listener);
    connect(opts.roomKey, room);
  } else {
    room.listeners.add(listener);
    // A late joiner missed the open frame; replay current status so its UI is accurate.
    listener({ type: room.ws?.readyState === WebSocket.OPEN ? "ws:open" : "ws:connecting" });
  }
  return () => {
    const r = rooms.get(opts.roomKey);
    if (!r) return;
    r.listeners.delete(listener);
    if (r.listeners.size === 0) {
      if (r.retryTimer) clearTimeout(r.retryTimer);
      rooms.delete(opts.roomKey);
      r.ws?.close();
    }
  };
}

/** Overlay-style subscription: the scene's subscriber token is both the credential and the room key. */
export function subscribeToWsRoom(
  subscriberToken: string,
  wsUrl: string,
  listener: WsEventListener
): () => void {
  return subscribeToWsRoomWith(
    { roomKey: subscriberToken, wsUrl, getToken: () => subscriberToken },
    listener
  );
}

/** Maps the internal `ws:*` control frames onto a simple status value. */
export function wsStatusFromMessage(msg: unknown): WsRoomStatus | null {
  const type = (msg as { type?: string })?.type;
  if (type === "ws:open") return "connected";
  if (type === "ws:close") return "disconnected";
  if (type === "ws:connecting") return "connecting";
  return null;
}
