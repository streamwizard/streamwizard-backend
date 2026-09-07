import { NextRequest, NextResponse } from "next/server";
import { reportError } from "@repo/sentry";
import { bearerToken, corsHeaders, isRateLimited, userIdForToken } from "@/lib/widget-api";
import { userStateService } from "@/lib/user-state-service";

/**
 * Channel-wide widget state, as opposed to /api/widgets/state which is scoped
 * to a single placed widget instance.
 *
 * The difference matters: this store is written by the server too (stream
 * lifecycle lands in `sys.` keys), which is what lets a widget find out about
 * something that happened while it was closed. The walking-stats overlay reads
 * `sys.stream_id` here to decide whether the distance it banked belongs to the
 * stream that is running now.
 */

// Widgets own their own keys, but the sys. namespace is the server's word on
// what happened — a token holder who could write it could forge the current
// stream and reset someone's distance at will. RLS rejects it too; this is the
// early, legible failure.
const RESERVED_PREFIX = "sys.";
const KEY_PATTERN = /^[a-z0-9_]{1,64}$/;
const MAX_VALUE_BYTES = 8192;
const OPS = new Set(["set", "increment", "delete"]);

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

function unauthorized(req: NextRequest) {
  return NextResponse.json(
    { error: "Not found or unauthorized" },
    { status: 403, headers: corsHeaders(req) }
  );
}

export async function GET(req: NextRequest) {
  const headers = { ...corsHeaders(req), "Cache-Control": "no-store" };

  const token = bearerToken(req) ?? req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400, headers });
  }
  if (isRateLimited(token)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers });
  }

  const userId = await userIdForToken(token);
  if (!userId) return unauthorized(req);

  const key = req.nextUrl.searchParams.get("key");

  try {
    // Reads go through the service so a key with a daily reset policy is
    // lazily reset before it is returned — a widget loading just after
    // midnight must not render yesterday's counter.
    if (key === null) {
      return NextResponse.json({ state: await userStateService.getAll(userId) }, { headers });
    }
    return NextResponse.json({ value: await userStateService.get(userId, key) }, { headers });
  } catch (error) {
    reportError(error, "api/widgets/user-state: read");
    return NextResponse.json({ error: "Failed to read state" }, { status: 500, headers });
  }
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers });
  }

  const { token: bodyToken, key, value, op: rawOp } = body as Record<string, unknown>;
  const token = bearerToken(req) ?? bodyToken;
  // `op` arrived with the atomic-mutation API; older widgets that only ever
  // sent {key, value} keep working because absence means plain set.
  const op = rawOp === undefined ? "set" : rawOp;

  if (typeof token !== "string" || typeof key !== "string") {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400, headers });
  }
  if (typeof op !== "string" || !OPS.has(op)) {
    return NextResponse.json(
      { error: 'op must be "set", "increment" or "delete"' },
      { status: 400, headers }
    );
  }
  if (isRateLimited(token)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers });
  }
  if (key.startsWith(RESERVED_PREFIX)) {
    return NextResponse.json(
      { error: `Keys starting with "${RESERVED_PREFIX}" are written by the server only` },
      { status: 403, headers }
    );
  }
  if (!KEY_PATTERN.test(key)) {
    return NextResponse.json(
      { error: "Key must be 1-64 characters of a-z, 0-9 or _" },
      { status: 400, headers }
    );
  }

  if (op === "set") {
    // `undefined` has no JSON representation and the column is NOT NULL, so a
    // widget that means "forget this" has to say so with null (or op delete).
    if (value === undefined) {
      return NextResponse.json({ error: "Missing value" }, { status: 400, headers });
    }

    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch {
      return NextResponse.json({ error: "Value is not serializable" }, { status: 400, headers });
    }
    if (Buffer.byteLength(serialized, "utf8") > MAX_VALUE_BYTES) {
      return NextResponse.json(
        { error: `Value exceeds ${MAX_VALUE_BYTES} bytes` },
        { status: 413, headers }
      );
    }
  }

  if (op === "increment" && (typeof value !== "number" || !Number.isFinite(value))) {
    return NextResponse.json(
      { error: "Increment requires a finite numeric value" },
      { status: 400, headers }
    );
  }

  const userId = await userIdForToken(token);
  if (!userId) return unauthorized(req);

  try {
    const result =
      op === "increment"
        ? await userStateService.increment(userId, key, value as number)
        : op === "delete"
          ? await userStateService.delete(userId, key)
          : await userStateService.set(userId, key, value);
    // The new value comes back so a widget can render its own mutation
    // immediately instead of waiting for the ws frame to loop around.
    return NextResponse.json(
      { ok: true, value: result.value, updatedAt: result.updatedAt },
      { headers }
    );
  } catch (error) {
    // The op function rejects increments on non-numeric values with a typed
    // Postgres error — that is the widget's bug, not a server failure.
    if (isInvalidParameter(error)) {
      return NextResponse.json({ error: invalidParameterMessage(error) }, { status: 400, headers });
    }
    reportError(error, "api/widgets/user-state: write");
    return NextResponse.json({ error: "Failed to save state" }, { status: 500, headers });
  }
}

// PostgREST surfaces RAISE EXCEPTION ... ERRCODE 'invalid_parameter_value' as
// code 22023 with the raise's message.
function isInvalidParameter(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: string }).code === "22023"
  );
}

function invalidParameterMessage(error: unknown): string {
  const message = (error as { message?: string }).message;
  return typeof message === "string" && message.length > 0 ? message : "Invalid operation";
}
