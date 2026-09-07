/** Row shapes the subscriptions screen renders, flattened from the query layer. */

export type ProductWithPlans = {
  id: string;
  name: string;
  plans: { id: string; name: string }[];
};

export type SubscriptionRow = {
  id: string;
  user_id: string;
  status: string;
  current_period_end: string | null;
  grant_note: string | null;
  plan: { id: string; name: string; product: { id: string; name: string } };
};

export type UserRow = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
};
