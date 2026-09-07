"use server";

import { reportError } from "@repo/sentry";

import { assertAdmin } from "@/lib/assert-admin";
import { createAdminClient } from "@repo/supabase/next/admin";
import {
  cancelSubscription,
  cancelSubscriptions,
  getLiveSubscriptionsForUser,
  getPlanLimits,
  getPlanProductId,
  updateSubscriptionGrant,
  upsertSubscriptionGrant,
} from "@repo/supabase/queries/subscriptions";
import { updateObsInstancesByUser } from "@repo/supabase/queries/obs-nodes";
import { revalidatePath } from "next/cache";

// Product whose plans carry cloud-OBS resource limits + a config_template folder.
const CLOUD_OBS_PRODUCT_ID = "cloud_obs";

const SUBSCRIPTIONS_PATH = "/subscriptions";

async function requireAdminContext() {
  const adminUserId = await assertAdmin();
  return { adminClient: createAdminClient(), adminUserId };
}

export async function grantSubscriptionAction(
  userId: string,
  planId: string,
  status: "active" | "trialing",
  expiresAt: string | null,
  note: string | null
) {
  const { adminClient, adminUserId } = await requireAdminContext();

  // Cancel any existing active subscriptions for the same product first
  const productId = await getPlanProductId(adminClient, planId);
  if (!productId) return { error: "Plan not found" };

  const { data: existing } = await getLiveSubscriptionsForUser(adminClient, userId);
  const toCancel = (existing ?? []).filter((s) => (s.plans as { product_id: string }).product_id === productId);

  if (toCancel.length > 0) {
    await cancelSubscriptions(adminClient, toCancel.map((s) => s.id));
  }

  const { error } = await upsertSubscriptionGrant(adminClient, {
    user_id: userId,
    plan_id: planId,
    status,
    granted_by: adminUserId,
    grant_note: note || null,
    current_period_end: expiresAt || null,
  });

  if (error) {
    reportError(error, "actions/subscriptions");
    return { error: error.message };
  }

  // Re-apply the new plan to the user's existing cloud-OBS instances so an
  // upgrade/downgrade takes effect on their next start: the profile folder
  // (config_template) and the resource snapshot the resume path reads from the
  // row. A running instance keeps its current container until it next restarts.
  // Best-effort: the subscription is already granted, so a failure here is logged
  // but doesn't fail the action (instances still pick up the plan on next start).
  if (productId === CLOUD_OBS_PRODUCT_ID) {
    try {
      const limits = await getPlanLimits(adminClient, planId);
      if (limits) {
        await updateObsInstancesByUser(adminClient, userId, {
          config_template: limits.config_template ?? null,
          resolution: limits.resolution,
          memory_mb: limits.memory_mb,
          cpu_quota: limits.cpu_quota,
          shm_size: limits.shm_size,
          // limits jsonb calls it vram_mb; the column is vram_allocated_mb.
          vram_allocated_mb: limits.vram_mb,
        });
      }
    } catch (e) {
      reportError(e, "actions/subscriptions:reapply-instances");
    }
  }

  revalidatePath(SUBSCRIPTIONS_PATH);
  return { error: null };
}

export async function revokeSubscriptionAction(subscriptionId: string) {
  const { adminClient } = await requireAdminContext();

  const { error } = await cancelSubscription(adminClient, subscriptionId);

  if (error) {
    reportError(error, "actions/subscriptions");
    return { error: error.message };
  }
  revalidatePath(SUBSCRIPTIONS_PATH);
  return { error: null };
}

export async function updateSubscriptionAction(
  subscriptionId: string,
  updates: {
    status: "active" | "trialing" | "past_due";
    expiresAt: string | null;
    note: string | null;
  }
) {
  const { adminClient } = await requireAdminContext();

  const { error } = await updateSubscriptionGrant(adminClient, subscriptionId, {
    status: updates.status,
    current_period_end: updates.expiresAt || null,
    grant_note: updates.note || null,
  });

  if (error) {
    reportError(error, "actions/subscriptions");
    return { error: error.message };
  }
  revalidatePath(SUBSCRIPTIONS_PATH);
  return { error: null };
}
