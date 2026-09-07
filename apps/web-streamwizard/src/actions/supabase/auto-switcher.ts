"use server";

import { createClient } from "@repo/supabase/next/server";
import {
  selectAutoSwitcherConfig,
  updateSceneOverride,
  upsertAutoSwitcherConfig as upsertConfigRow,
  type AutoSwitcherConfigRow,
} from "@repo/supabase/queries/auto-switcher";
import { autoSwitcherFormSchema, type AutoSwitcherFormValues } from "@repo/schemas";
import { reportError } from "@repo/sentry";
import { broadcastToUser } from "@repo/ws-client";
import { env } from "@/lib/env";

// Every write ends with a push through ws-server /internal/broadcast so the
// engine reacts within ~1s. The DB row stays the source of truth: if the push
// fails (or CONSUMER_SECRET isn't configured) the engine's periodic re-fetch
// picks the change up within a minute — so push failures never fail the save.
async function pushConfigToEngine(row: AutoSwitcherConfigRow): Promise<void> {
  const result = await broadcastToUser(row.user_id, "streamwizard.auto_switcher_config", row, {
    wsServerUrl: env.WS_SERVER_URL,
    consumerSecret: env.CONSUMER_SECRET,
  });
  if (!result.ok && result.reason === "network") {
    reportError(result.error, "auto-switcher: config push");
  }
}

export async function getAutoSwitcherConfig(): Promise<AutoSwitcherConfigRow | null> {
  const supabase = await createClient();
  const { data } = await selectAutoSwitcherConfig(supabase);
  return data;
}

export async function upsertAutoSwitcherConfig(
  values: AutoSwitcherFormValues,
): Promise<{ ok: boolean; data?: AutoSwitcherConfigRow; error?: string }> {
  const parsed = autoSwitcherFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "Not signed in" };

  const { data, error } = await upsertConfigRow(supabase, user.id, parsed.data);
  if (error) {
    reportError(error, "auto-switcher: upsert");
    return { ok: false, error: "Could not save settings" };
  }

  await pushConfigToEngine(data);
  // The saved row goes back to the caller so client state (the deck's switcher
  // tab) can refresh without a page load.
  return { ok: true, data };
}

export async function setSceneOverride(
  sceneUuid: string,
  sceneName: string | null,
  durationMinutes: number | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!sceneUuid || sceneUuid.length > 200) return { ok: false, error: "Invalid scene" };
  if (durationMinutes !== null && (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 24 * 60)) {
    return { ok: false, error: "Invalid duration" };
  }

  const supabase = await createClient();
  // getUser refreshes an expired session (and distinguishes "logged out" from
  // "no config row") -- the deck stays open for hours on a phone, so a stale
  // cookie is a real path here, not an edge case.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "Session expired. Refresh the page." };

  const { data, error } = await updateSceneOverride(supabase, user.id, {
    override_scene_uuid: sceneUuid,
    override_scene_name: sceneName,
    override_expires_at: durationMinutes ? new Date(Date.now() + durationMinutes * 60_000).toISOString() : null,
  });
  if (error || !data) {
    reportError(error, "auto-switcher: override set");
    return { ok: false, error: error ? `Could not set the override (${error.message})` : "Save your switcher settings first" };
  }

  await pushConfigToEngine(data);
  return { ok: true };
}

export async function clearSceneOverride(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "Session expired. Refresh the page." };

  const { data, error } = await updateSceneOverride(supabase, user.id, {
    override_scene_uuid: null,
    override_scene_name: null,
    override_expires_at: null,
  });
  if (error || !data) {
    reportError(error, "auto-switcher: override clear");
    return { ok: false, error: error ? `Could not clear the override (${error.message})` : "Could not clear the override" };
  }

  await pushConfigToEngine(data);
  return { ok: true };
}
