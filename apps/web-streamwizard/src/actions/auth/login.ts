"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@repo/supabase/next/server";
import { TWITCH_SCOPES } from "@/lib/constant";
import { reportAndRedirect } from "@/lib/report-redirect";

export async function login(next?: string | null) {
  const supabase = await createClient();

  const headersList = await headers();
  const origin = headersList.get("origin");

  const safeNext = next && next.startsWith("/") && !next.startsWith("//") && !next.includes("://") ? next : "/dashboard";

  // Already signed in: skip the round trip to Supabase and Twitch entirely.
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user) redirect(safeNext);

  const { error, data } = await supabase.auth.signInWithOAuth({
    provider: "twitch",
    options: {
      redirectTo: `${origin}/auth/callback/twitch?next=${encodeURIComponent(safeNext)}`,
      scopes: TWITCH_SCOPES.join(" "),
    },
  });

  if (error) {
    reportAndRedirect(error, "/error?code=auth");
  }

  redirect(data.url);
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signUp(data);

  if (error) {
    reportAndRedirect(error, "/error");
  }

  revalidatePath("/", "layout");
  redirect("/");
}
