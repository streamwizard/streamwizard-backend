import { env } from "../lib/env";
import { supabase } from "@repo/supabase";
import { getOverlaySceneBySubscriberToken } from "@repo/supabase/queries/overlays";
import type { OverlayEventType } from "@repo/types";
import { trackWsAuthFailure } from "@repo/metrics";
import { isRateLimited } from "../rate-limit";
import { rooms } from "../rooms";
import { findCurrentStreamId, handleInternalRoute, isValidSecret } from "./internal-http";
import type { ConnectionData } from "../types";

type BunServer = import("bun").Server<ConnectionData>;

const VALID_ROLES = new Set(["publisher", "subscriber", "bot", "monitor", "consumer"]);

/** Monotonic per-connection id, used for metrics and the monitor feed. */
let nextConnId = 1;

/**
 * Resolves a connection token to a user id. Two kinds are accepted on both the
 * publisher and subscriber paths: a Supabase JWT (a signed-in dashboard user)
 * or an overlay scene's subscriber token (a browser source or the GPS overlay
 * page, which have no session).
 */
async function resolveUserIdFromToken(token: string): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (user) return user.id;

  const { data: scene } = await getOverlaySceneBySubscriberToken(supabase, token);
  return scene?.user_id ?? null;
}

/**
 * Self-declared identity label ("ingest-node:<id>"). Never reject on a
 * bad/missing source — older bot clients don't send one — just fall back, and
 * constrain the charset so it's safe as a metrics tag.
 */
function parseSourceLabel(url: URL): string {
  const raw = url.searchParams.get("source");
  return raw && /^[a-zA-Z0-9:_.-]{1,64}$/.test(raw) ? raw : "unknown";
}

function parseCsvSet<T extends string>(url: URL, param: string): Set<T> {
  const raw = url.searchParams.get(param);
  if (!raw) return new Set<T>();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0) as T[],
  );
}

/** Every role ends the same way: upgrade, or report why it couldn't. */
function upgradeOrFail(
  server: BunServer,
  req: Request,
  role: "publisher" | "subscriber" | "bot" | "monitor" | "consumer",
  data: Omit<ConnectionData, "connectedAt" | "connId">,
): Response | undefined {
  const upgraded = server.upgrade(req, {
    data: { ...data, connectedAt: Date.now(), connId: `c-${nextConnId++}` } as ConnectionData,
  });
  if (!upgraded) {
    trackWsAuthFailure(role === "monitor" ? "unknown" : role, "upgrade_failed");
    return new Response("Upgrade Failed", { status: 500 });
  }
  return undefined;
}

export async function handleUpgrade(req: Request, server: BunServer): Promise<Response | undefined> {
  const url = new URL(req.url);

  // Plain HTTP first: the health probe and the secret-gated injection points.
  const internal = handleInternalRoute(req, url.pathname);
  if (internal) return internal;

  if (url.pathname !== "/ws") {
    return new Response("Not Found", { status: 404 });
  }

  const role = url.searchParams.get("role");

  if (!role || !VALID_ROLES.has(role)) {
    trackWsAuthFailure("unknown", "invalid_role");
    return new Response("Bad Request: missing or invalid role", { status: 400 });
  }

  // --- Monitor ---
  if (role === "monitor") {
    if (!env.MONITOR_SECRET) {
      return new Response("Monitor not configured", { status: 404 });
    }
    if (!isValidSecret(url.searchParams.get("token"), env.MONITOR_SECRET)) {
      trackWsAuthFailure("unknown", "invalid_token");
      return new Response("Unauthorized", { status: 401 });
    }
    return upgradeOrFail(server, req, "monitor", {
      role: "monitor",
      userId: "_monitor",
      channels: new Set<OverlayEventType>(),
    });
  }

  // --- Bot ---
  if (role === "bot") {
    const key = req.headers.get("authorization")?.replace("Bearer ", "");
    if (key !== env.SUPABASE_SECRET_KEY) {
      trackWsAuthFailure("bot", "invalid_bot_key");
      return new Response("Unauthorized", { status: 401 });
    }
    return upgradeOrFail(server, req, "bot", {
      role: "bot",
      userId: "_bot",
      source: parseSourceLabel(url),
      channels: new Set<OverlayEventType>(),
    });
  }

  // --- Consumer (trusted server-side firehose: obs-auto-switcher) ---
  if (role === "consumer") {
    if (!env.CONSUMER_SECRET) {
      return new Response("Consumer not configured", { status: 404 });
    }
    const key = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!isValidSecret(key, env.CONSUMER_SECRET)) {
      trackWsAuthFailure("consumer", "invalid_bot_key");
      return new Response("Unauthorized", { status: 401 });
    }
    return upgradeOrFail(server, req, "consumer", {
      role: "consumer",
      userId: "_consumer",
      source: parseSourceLabel(url),
      consumerTypes: parseCsvSet(url, "types"),
      channels: new Set<OverlayEventType>(),
    });
  }

  // --- Publisher ---
  if (role === "publisher") {
    const token = url.searchParams.get("token");
    if (!token) {
      trackWsAuthFailure("publisher", "missing_token");
      return new Response("Unauthorized: missing token", { status: 401 });
    }

    const resolvedUserId = await resolveUserIdFromToken(token);
    if (!resolvedUserId) {
      trackWsAuthFailure("publisher", "invalid_token");
      return new Response("Unauthorized: invalid token", { status: 401 });
    }

    const session_id = crypto.randomUUID();
    const stream_id = await findCurrentStreamId(resolvedUserId);

    const failed = upgradeOrFail(server, req, "publisher", {
      role: "publisher",
      userId: resolvedUserId,
      session_id,
      channels: new Set<OverlayEventType>(),
    });
    if (failed) return failed;

    console.log(`[publisher] connected userId=${resolvedUserId} session=${session_id} stream=${stream_id ?? "none"}`);

    const existingRoom = rooms.get(resolvedUserId);
    rooms.set(resolvedUserId, {
      publisher: null,
      subscribers: existingRoom?.subscribers ?? new Set(),
      session_id,
      stream_id,
    });

    return undefined;
  }

  // --- Subscriber ---
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(ip)) {
    trackWsAuthFailure("subscriber", "rate_limited");
    return new Response("Too Many Requests", { status: 429 });
  }

  const subscriberToken = url.searchParams.get("token");
  if (!subscriberToken) {
    trackWsAuthFailure("subscriber", "missing_token");
    return new Response("Unauthorized: missing token", { status: 401 });
  }

  const subscriberUserId = await resolveUserIdFromToken(subscriberToken);
  if (!subscriberUserId) {
    trackWsAuthFailure("subscriber", "invalid_token");
    return new Response("Unauthorized: invalid token", { status: 401 });
  }

  return upgradeOrFail(server, req, "subscriber", {
    role: "subscriber",
    userId: subscriberUserId,
    channels: parseCsvSet<OverlayEventType>(url, "channels"),
  });
}
