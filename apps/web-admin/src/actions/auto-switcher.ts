"use server";

import { assertAdmin } from "@/lib/assert-admin";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  selectAutoSwitcherConfig,
  updateSceneOverride,
  upsertAutoSwitcherConfig,
  type AutoSwitcherConfigRow,
} from "@repo/supabase/queries/auto-switcher";
import { autoSwitcherFormSchema, type AutoSwitcherFormValues } from "@repo/schemas";
import { reportError } from "@repo/sentry";
import { broadcastToUser } from "@repo/ws-client";
import { env } from "@/lib/env";

// Every write ends with a push through ws-server /internal/broadcast so the
// engine reacts within ~1s. The DB row stays the source of truth: if the push
// fails (or WS_SERVER_URL/CONSUMER_SECRET aren't configured here) the engine's
// periodic re-fetch picks the change up within a minute — so push failures
// never fail the save.
async function pushConfigToEngine(row: AutoSwitcherConfigRow): Promise<void> {
  const result = await broadcastToUser(row.user_id, "streamwizard.auto_switcher_config", row, {
    wsServerUrl: env.WS_SERVER_URL,
    consumerSecret: env.CONSUMER_SECRET,
  });
  if (!result.ok && result.reason === "network") {
    reportError(result.error, "web-admin auto-switcher: config push");
  }
}

export async function getAutoSwitcherConfigForUser(userId: string): Promise<AutoSwitcherConfigRow | null> {
  await assertAdmin();
  const { data } = await selectAutoSwitcherConfig(supabaseAdmin, userId);
  return data;
}

export async function upsertAutoSwitcherConfigForUser(
  userId: string,
  values: AutoSwitcherFormValues,
): Promise<{ ok: boolean; data?: AutoSwitcherConfigRow; error?: string }> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  const parsed = autoSwitcherFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  }

  const { data, error } = await upsertAutoSwitcherConfig(supabaseAdmin, userId, parsed.data);
  if (error) {
    reportError(error, "web-admin auto-switcher: upsert");
    return { ok: false, error: "Could not save settings" };
  }

  await pushConfigToEngine(data);
  return { ok: true, data };
}

export async function setSceneOverrideForUser(
  userId: string,
  sceneUuid: string,
  sceneName: string | null,
  durationMinutes: number | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "Forbidden" };
  }
  if (!sceneUuid || sceneUuid.length > 200) return { ok: false, error: "Invalid scene" };
  if (durationMinutes !== null && (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 24 * 60)) {
    return { ok: false, error: "Invalid duration" };
  }

  const { data, error } = await updateSceneOverride(supabaseAdmin, userId, {
    override_scene_uuid: sceneUuid,
    override_scene_name: sceneName,
    override_expires_at: durationMinutes ? new Date(Date.now() + durationMinutes * 60_000).toISOString() : null,
  });
  if (error || !data) {
    reportError(error, "web-admin auto-switcher: override set");
    return { ok: false, error: error ? `Could not set the override (${error.message})` : "The user has no switcher settings yet" };
  }

  await pushConfigToEngine(data);
  return { ok: true };
}

export async function clearSceneOverrideForUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  const { data, error } = await updateSceneOverride(supabaseAdmin, userId, {
    override_scene_uuid: null,
    override_scene_name: null,
    override_expires_at: null,
  });
  if (error || !data) {
    reportError(error, "web-admin auto-switcher: override clear");
    return { ok: false, error: error ? `Could not clear the override (${error.message})` : "Could not clear the override" };
  }

  await pushConfigToEngine(data);
  return { ok: true };
}
