import { redirect } from "next/navigation";
import { createClient } from "@repo/supabase/next/server";
import { getProductAccess, type ProductAccess } from "@repo/supabase/queries/subscriptions";

export type { ProductAccess };

export async function requireProductAccess(productId: string): Promise<ProductAccess> {
  const supabase = await createClient();
  const access = await getProductAccess(supabase, productId);
  if (!access.canAccess) {
    redirect(`/dashboard/upgrade?feature=${productId}`);
  }
  return access;
}
