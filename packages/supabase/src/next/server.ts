import type { Database } from "../types/supabase";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

// Fall back to the non-prefixed Doppler vars: NEXT_PUBLIC_ values are baked
// into the bundle at build time and are only populated when Supabase env is
// present *then* (or by an app's env.ts side-effect). Reading the plain names
// here keeps the server clients working regardless of import order or a build
// that ran without them. Use `||` (not `??`) so a baked-in empty string —
// which is what next.config writes when SUPABASE_URL was absent at build —
// also falls through to the runtime value.
function resolveSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLIC_KEY!;
  return { url, key };
}

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = resolveSupabaseEnv();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — safe to ignore.
        }
      },
    },
  });
}

// Route-handler client that writes session cookies straight onto `response`.
// Handlers that finish with a redirect (e.g. the OAuth callback) can't rely on
// next/headers cookies() propagating onto a manually built redirect response —
// behind the staging proxy those Set-Cookie headers were being dropped, so the
// dashboard gate saw no session ("Auth session missing!"). Binding the writes
// to the exact response we return makes the cookies part of the redirect.
export function createRouteHandlerClient(request: NextRequest, response: NextResponse) {
  const { url, key } = resolveSupabaseEnv();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
}
