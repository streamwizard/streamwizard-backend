import { createAdminClient } from "@repo/supabase/next/admin";
import { getSubscriptionsOverview } from "@repo/supabase/queries/subscriptions";
import { SubscriptionsClient, type ProductWithPlans, type SubscriptionRow, type UserRow } from "@/components/subscriptions/subscriptions-client";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  const adminClient = createAdminClient();

  const {
    users: rawUsers,
    subscriptions: rawSubscriptions,
    products: rawProducts,
  } = await getSubscriptionsOverview(adminClient);

  const users: UserRow[] = rawUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatar_url: u.avatar_url,
  }));

  const subscriptions: SubscriptionRow[] = rawSubscriptions.flatMap((s) => {
    const plan = s.plans as unknown as { id: string; name: string; products: { id: string; name: string } } | null;
    if (!plan) return [];
    return [{
      id: s.id,
      user_id: s.user_id,
      status: s.status,
      current_period_end: s.current_period_end,
      grant_note: s.grant_note,
      plan: {
        id: plan.id,
        name: plan.name,
        product: plan.products,
      },
    }];
  });

  const products: ProductWithPlans[] = rawProducts.map((p) => ({
    id: p.id,
    name: p.name,
    plans: ((p.plans as { id: string; name: string; sort_order: number }[]) ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(({ id, name }) => ({ id, name })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Subscriptions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Grant or revoke product access for users. Admin grants are independent of Stripe.
        </p>
      </div>
      <SubscriptionsClient
        users={users}
        subscriptions={subscriptions}
        products={products}
      />
    </div>
  );
}
