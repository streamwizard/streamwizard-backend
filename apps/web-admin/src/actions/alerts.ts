"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { assertAdmin } from "@/lib/assert-admin";

/** hours = null clears the silence. The engine skips notifications while
 * silenced_until is in the future but keeps recording state/events. */
export async function silenceAlert(stateId: string, hours: number | null): Promise<void> {
  await assertAdmin();

  const silenced_until = hours === null ? null : new Date(Date.now() + hours * 3_600_000).toISOString();
  const { error } = await supabaseAdmin
    .from("alert_state")
    .update({ silenced_until, updated_at: new Date().toISOString() })
    .eq("id", stateId);
  if (error) throw new Error(`Couldn't update silence: ${error.message}`);

  revalidatePath("/alerts");
}
