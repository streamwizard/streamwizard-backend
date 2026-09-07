import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export interface CloudObsPlanLimits {
  resolution: string;
  fps: number;
  max_instances: number;
  memory_mb: number;
  cpu_quota: number;
  shm_size: string;
  vram_mb: number;
  // Names the plan-owned OBS template folder under obs-templates/ whose profile
  // (resolution/fps/encoder) each instance is seeded from. Optional: plans seeded
  // before this key exists fall back to the manager's DEFAULT_TEMPLATE.
  config_template?: string;
}

/**
 * Highest asset-storage quota (media library, R2) granted by any of the user's
 * active subscriptions, from plans.limits->storage->asset_quota_mb. Null when
 * no active plan grants one; callers fall back to the free default.
 */
export async function getUserAssetQuotaMb(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("user_subscriptions")
    .select("plans(limits)")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"]);
  let max: number | null = null;
  for (const row of data ?? []) {
    const plan = Array.isArray(row.plans) ? row.plans[0] : row.plans;
    const limits = plan?.limits as { storage?: { asset_quota_mb?: number } } | null;
    const quota = limits?.storage?.asset_quota_mb;
    if (typeof quota === "number" && (max === null || quota > max)) max = quota;
  }
  return max;
}

export type ProductAccess = {
  canAccess: boolean;
  canInteract: boolean;
  status: string;
  plan: {
    id: string;
    name: string;
    limits: Record<string, unknown>;
  } | null;
};

export async function getPlanLimits(
  supabase: SupabaseClient<Database>,
  planId: string,
): Promise<CloudObsPlanLimits | null> {
  const { data } = await supabase.from("plans").select("limits").eq("id", planId).maybeSingle();
  if (!data) return null;
  return data.limits as unknown as CloudObsPlanLimits;
}

export async function getSubscriptionLimits(
  supabase: SupabaseClient<Database>,
  subscriptionId: string,
): Promise<CloudObsPlanLimits | null> {
  const { data } = await supabase
    .from("user_subscriptions")
    .select("plans(limits)")
    .eq("id", subscriptionId)
    .in("status", ["active", "trialing", "past_due"])
    .maybeSingle();
  if (!data) return null;
  const plan = Array.isArray(data.plans) ? data.plans[0] : data.plans;
  if (!plan) return null;
  return plan.limits as unknown as CloudObsPlanLimits;
}

/** Returns the ID of the user's active subscription for the given product, or null. */
export async function getUserActiveSubscriptionId(
  supabase: SupabaseClient<Database>,
  userId: string,
  productId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_subscriptions")
    .select("id, plans!inner(product_id)")
    .eq("user_id", userId)
    .eq("plans.product_id", productId)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function getProductAccess(
  supabase: SupabaseClient<Database>,
  productId: string
): Promise<ProductAccess> {
  const { data } = await supabase.rpc("get_product_access", { p_product_id: productId });

  const row = data?.[0];
  if (!row) {
    return { canAccess: false, canInteract: false, status: "none", plan: null };
  }

  return {
    canAccess: row.can_access ?? false,
    canInteract: row.can_interact ?? false,
    status: row.status ?? "none",
    plan: row.plan_id
      ? {
          id: row.plan_id,
          name: row.plan_name ?? "",
          limits: (row.limits as Record<string, unknown>) ?? {},
        }
      : null,
  };
}

// ── Admin grants ─────────────────────────────────────────────────────────────
// Service-role only: web-admin grants and revokes access independently of
// Stripe, so these bypass RLS by design.

const LIVE_SUBSCRIPTION_FILTER = "(canceled,inactive)";

export async function getPlanProductId(client: DBClient, planId: string): Promise<string | null> {
  const { data } = await client.from("plans").select("product_id").eq("id", planId).single();
  return data?.product_id ?? null;
}

/** A user's subscriptions that still count as live, with the product they belong to. */
export async function getLiveSubscriptionsForUser(client: DBClient, userId: string) {
  return client
    .from("user_subscriptions")
    .select("id, plan_id, plans!inner(product_id)")
    .eq("user_id", userId)
    .not("status", "in", LIVE_SUBSCRIPTION_FILTER);
}

export async function cancelSubscriptions(client: DBClient, subscriptionIds: string[]) {
  return client
    .from("user_subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .in("id", subscriptionIds);
}

export async function cancelSubscription(client: DBClient, subscriptionId: string) {
  return client
    .from("user_subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", subscriptionId);
}

export async function upsertSubscriptionGrant(
  client: DBClient,
  grant: {
    user_id: string;
    plan_id: string;
    status: "active" | "trialing";
    granted_by: string;
    grant_note: string | null;
    current_period_end: string | null;
  },
) {
  return client
    .from("user_subscriptions")
    .upsert({ ...grant, updated_at: new Date().toISOString() }, { onConflict: "user_id,plan_id" });
}

export async function updateSubscriptionGrant(
  client: DBClient,
  subscriptionId: string,
  updates: {
    status: "active" | "trialing" | "past_due";
    current_period_end: string | null;
    grant_note: string | null;
  },
) {
  return client
    .from("user_subscriptions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", subscriptionId);
}

/** Every user, every live subscription and the product/plan catalog — the admin grants screen. */
export async function getSubscriptionsOverview(client: DBClient) {
  const [users, subscriptions, products] = await Promise.all([
    client.from("users").select("id, name, email, avatar_url").order("name"),
    client
      .from("user_subscriptions")
      .select("id, user_id, status, current_period_end, grant_note, plans(id, name, products(id, name))")
      .not("status", "in", LIVE_SUBSCRIPTION_FILTER),
    client.from("products").select("id, name, plans(id, name, sort_order)").order("id"),
  ]);

  return {
    users: users.data ?? [],
    subscriptions: subscriptions.data ?? [],
    products: products.data ?? [],
  };
}
