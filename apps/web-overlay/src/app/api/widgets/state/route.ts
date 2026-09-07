import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { reportError } from "@repo/sentry";
import { Json } from "@repo/supabase";
// Was a second copy of the same allowlist. Shared now so the sandboxed-iframe
// origin can't be handled in one route and forgotten in the other.
import { corsHeaders } from "@/lib/widget-api";

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

async function resolveInstance(token: string, itemId: string) {
  // Step 1: resolve subscriber_token → scene_id

  const { data: scene } = await supabaseAdmin
    .from("overlay_scenes")
    .select("id")
    .eq("subscriber_token", token)
    .maybeSingle();

  if (!scene) return null;

  // Step 2: confirm the item belongs to that scene
  const { data: item } = await supabaseAdmin
    .from("overlay_items")
    .select("id")
    .eq("id", itemId)
    .eq("scene_id", scene.id)
    .maybeSingle();

  if (!item) return null;

  // Step 3: fetch the widget instance row
  const { data: instance } = await supabaseAdmin
    .from("overlay_widget_instances")
    .select("id, widget_state")
    .eq("overlay_item_id", itemId)
    .maybeSingle();

  return instance ?? null;
}

// The subscriber token is a secret; prefer the Authorization header so it
// stays out of URLs and logs. Query/body token remains supported for widgets
// written against the original contract.
function bearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length);
  return null;
}

export async function GET(req: NextRequest) {
  const token = bearerToken(req) ?? req.nextUrl.searchParams.get("token");
  const itemId = req.nextUrl.searchParams.get("itemId");

  if (!token || !itemId) {
    return NextResponse.json({ error: "Missing token or itemId" }, { status: 400, headers: corsHeaders(req) });
  }

  const instance = await resolveInstance(token, itemId);
  if (!instance) {
    return NextResponse.json({ error: "Not found or unauthorized" }, { status: 403, headers: corsHeaders(req) });
  }

  return NextResponse.json({ state: instance.widget_state ?? {} }, { headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders(req) });
  }

  const { token: bodyToken, itemId, state } = body as Record<string, unknown>;
  const token = bearerToken(req) ?? bodyToken;

  if (typeof token !== "string" || typeof itemId !== "string" || typeof state !== "object" || state === null || Array.isArray(state)) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400, headers: corsHeaders(req) });
  }

  const instance = await resolveInstance(token, itemId);
  if (!instance) {
    return NextResponse.json({ error: "Not found or unauthorized" }, { status: 403, headers: corsHeaders(req) });
  }

  const { error } = await supabaseAdmin
    .from("overlay_widget_instances")
    .update({ widget_state: state as Json, updated_at: new Date().toISOString() })
    .eq("id", instance.id);

  if (error) {
    reportError(error, "api/widgets/state: widget_state update");
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }

  return NextResponse.json({ ok: true }, { headers: corsHeaders(req) });
}
