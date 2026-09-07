import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@repo/supabase/next/server";
import { getTwitchUserId } from "@repo/supabase/queries/user";
import { reportError } from "@repo/sentry";
import {
  isThirdPartyProvider,
  resolveBadges,
  resolveCheermotes,
  resolveThirdPartyEmotes,
} from "@repo/twitch-assets";

/**
 * Twitch chat assets for signed-in app surfaces (currently the deck's chat tab).
 *
 * The overlay has an equivalent route, but it authorises with a scene's
 * subscriber token — a credential the deck neither has nor should mint. Same
 * resolvers underneath, same Supabase-backed asset cache; only the way the
 * caller proves who it is differs. Being same-origin, this one needs no CORS
 * and no per-token bucket: the session is the limit.
 *
 * The broadcaster id comes from the session's Twitch integration and never
 * from the request, so this can't be used as an open Helix proxy.
 */

// Server-side TTLs are 1h–1d; this only smooths repeat calls in one page load.
const ASSET_CACHE_CONTROL = "private, max-age=60";

type Resource = "badges" | "cheermotes" | "emotes";

const RESOURCES = new Set<Resource>(["badges", "cheermotes", "emotes"]);

function isResource(value: string): value is Resource {
  return RESOURCES.has(value as Resource);
}

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/twitch/assets/[resource]">,
) {
  const { resource } = await ctx.params;

  if (!isResource(resource)) {
    return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const broadcasterId = await getTwitchUserId(supabase);
  if (!broadcasterId) {
    return NextResponse.json({ error: "No Twitch integration" }, { status: 403 });
  }

  try {
    const body = await handle(resource, broadcasterId, req.nextUrl.searchParams);
    if ("error" in body) {
      return NextResponse.json(body, { status: body.status ?? 400 });
    }
    return NextResponse.json(body.data, {
      headers: { "Cache-Control": ASSET_CACHE_CONTROL },
    });
  } catch (error) {
    reportError(error, `api/twitch/assets/${resource}`);
    return NextResponse.json({ error: "Upstream failure" }, { status: 502 });
  }
}

type Handled = { data: unknown } | { error: string; status?: number };

async function handle(
  resource: Resource,
  broadcasterId: string,
  params: URLSearchParams,
): Promise<Handled> {
  switch (resource) {
    case "badges":
      return { data: { badges: await resolveBadges(broadcasterId) } };

    case "cheermotes":
      return { data: { cheermotes: await resolveCheermotes(broadcasterId) } };

    case "emotes": {
      const provider = params.get("provider")?.trim() ?? "";
      if (!isThirdPartyProvider(provider)) {
        return { error: "Unknown provider", status: 400 };
      }
      return { data: { emotes: await resolveThirdPartyEmotes(provider, broadcasterId) } };
    }
  }
}
