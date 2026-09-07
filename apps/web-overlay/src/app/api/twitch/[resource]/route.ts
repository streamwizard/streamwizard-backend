import { NextResponse, type NextRequest } from "next/server";
import { reportError } from "@repo/sentry";
import {
  isThirdPartyProvider,
  liveFollowerTotal,
  liveStream,
  liveSubscriberTotal,
  resolveBadges,
  resolveCheermotes,
  resolveGame,
  resolveThirdPartyEmotes,
  resolveUsers,
} from "@repo/twitch-assets";
import {
  bearerToken,
  broadcasterIdForToken,
  corsHeaders,
  isRateLimited,
} from "@/lib/widget-api";

/**
 * Twitch lookups for overlay widgets.
 *
 * A widget can display any URL it already knows, but EventSub only gives it
 * ids: `badges[].set_id`, a cheermote `prefix`, a `user_id`. Helix has the
 * pictures, and the iframe can reach neither Helix (CSP) nor a credential
 * (it ships to every viewer). This route is the bridge — same origin, so the
 * existing `connect-src` already allows it, with the app token staying here.
 *
 * Two response policies, and the difference is the whole point:
 *
 *   Assets (badges, cheermotes, users, game, emotes) — Supabase-cached, and
 *   safe to let the browser hold briefly. A stale badge is an old picture.
 *
 *   Live counters (followers, subscribers, stream) — `no-store`, never cached
 *   anywhere. A goal widget refreshing mid-stream must come back with the true
 *   number, not the one that was true when some cache filled.
 */

// Asset responses may sit in the browser for a bit; the server-side TTLs are far
// longer, so this only smooths repeat calls within a single page load.
const ASSET_CACHE_CONTROL = "private, max-age=60";
const LIVE_CACHE_CONTROL = "no-store";

const LIVE_RESOURCES = new Set(["followers", "subscribers", "stream"]);

type Resource =
  | "badges"
  | "cheermotes"
  | "users"
  | "game"
  | "emotes"
  | "followers"
  | "subscribers"
  | "stream";

const RESOURCES = new Set<Resource>([
  "badges",
  "cheermotes",
  "users",
  "game",
  "emotes",
  "followers",
  "subscribers",
  "stream",
]);

function isResource(value: string): value is Resource {
  return RESOURCES.has(value as Resource);
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/twitch/[resource]">) {
  const { resource } = await ctx.params;
  const headers = corsHeaders(req);

  if (!isResource(resource)) {
    return NextResponse.json({ error: "Unknown resource" }, { status: 404, headers });
  }

  // Header only. /api/widgets/state still accepts ?token= for widgets written
  // against its original contract; this route is new, so it has no such debt
  // and shouldn't take one on — a token in a query string ends up in server
  // logs, referrers and error reports.
  const token = bearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401, headers });
  }

  if (isRateLimited(token)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429, headers });
  }

  // Never from the request. See broadcasterIdForToken.
  const broadcasterId = await broadcasterIdForToken(token);
  if (!broadcasterId) {
    return NextResponse.json(
      { error: "Not found or unauthorized" },
      { status: 403, headers }
    );
  }

  const cacheControl = LIVE_RESOURCES.has(resource) ? LIVE_CACHE_CONTROL : ASSET_CACHE_CONTROL;

  try {
    const body = await handle(resource, broadcasterId, req.nextUrl.searchParams);
    if ("error" in body) {
      return NextResponse.json(body, { status: body.status ?? 400, headers });
    }
    return NextResponse.json(body.data, {
      headers: { ...headers, "Cache-Control": cacheControl },
    });
  } catch (error) {
    reportError(error, `api/twitch/${resource}`);
    return NextResponse.json({ error: "Upstream failure" }, { status: 502, headers });
  }
}

type Handled = { data: unknown } | { error: string; status?: number };

async function handle(
  resource: Resource,
  broadcasterId: string,
  params: URLSearchParams
): Promise<Handled> {
  switch (resource) {
    case "badges":
      return { data: { badges: await resolveBadges(broadcasterId) } };

    case "cheermotes":
      return { data: { cheermotes: await resolveCheermotes(broadcasterId) } };

    case "users": {
      // The one resource taking caller-supplied ids: a chat widget resolves
      // arbitrary chatters, which is public data. Bounded and validated so it
      // can't be used as a bulk scraper.
      const raw = (params.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
      if (raw.length === 0) return { error: "Missing ids", status: 400 };
      if (raw.length > 100) return { error: "At most 100 ids per request", status: 400 };
      if (raw.some((id) => !/^\d+$/.test(id))) {
        return { error: "Ids must be numeric Twitch user ids", status: 400 };
      }
      return { data: { users: await resolveUsers(raw) } };
    }

    case "game": {
      const id = params.get("id")?.trim();
      if (!id) return { error: "Missing id", status: 400 };
      if (!/^\d+$/.test(id)) return { error: "Id must be a numeric game id", status: 400 };
      return { data: { game: (await resolveGame(id)) ?? null } };
    }

    case "emotes": {
      const provider = params.get("provider")?.trim() ?? "";
      if (!isThirdPartyProvider(provider)) {
        return { error: "Unknown provider", status: 400 };
      }
      return { data: { emotes: await resolveThirdPartyEmotes(provider, broadcasterId) } };
    }

    case "followers":
      return { data: { total: await liveFollowerTotal(broadcasterId) } };

    case "subscribers":
      return { data: { total: await liveSubscriberTotal(broadcasterId) } };

    case "stream":
      return { data: { stream: await liveStream(broadcasterId) } };
  }
}
