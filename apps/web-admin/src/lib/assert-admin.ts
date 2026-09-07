import { createClient } from "@repo/supabase/next/server";
import { supabaseAdmin } from "@repo/supabase/next/admin";

/** Server actions are their own POST endpoints — the layout's guard doesn't
 * cover them, so every alerts mutation re-checks admin here first.
 * Returns the acting user's id for audit columns. */
export async function assertAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");

  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) throw new Error("Not authorized");

  return data.user.id;
}
