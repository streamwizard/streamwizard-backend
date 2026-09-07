"use server";

import { reportError } from "@repo/sentry";
import { exportUserData } from "@repo/supabase/queries/data-export";

import { tryAuthContext } from "@/lib/auth";

export async function requestUserData() {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };

  try {
    const data = await exportUserData(ctx.supabase, {
      userId: ctx.user.id,
      broadcasterId: ctx.broadcasterId,
    });
    return { data, error: null };
  } catch (err) {
    // Fail the whole export rather than hand back a partial file that looks
    // complete — this is the user's "download my data" request.
    reportError(err, "request-data.requestUserData");
    return { data: null, error: "Failed to retrieve your data. Please try again." };
  }
}
