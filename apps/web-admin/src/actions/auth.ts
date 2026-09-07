"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@repo/supabase/next/server";

export async function signInWithTwitch() {
  const supabase = await createClient();
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? "http://localhost:3003";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "twitch",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth_failed");
  }

  redirect(data.url);
}
