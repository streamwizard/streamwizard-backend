import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export type OverlayTemplateRow = Database["public"]["Tables"]["overlay_templates"]["Row"];
export type OverlayTemplateItemRow = Database["public"]["Tables"]["overlay_template_items"]["Row"];
export type WidgetTemplateRow = Database["public"]["Tables"]["overlay_widget_templates"]["Row"];

/** Published templates for the "start from" picker, in catalog order. */
export async function getOverlayTemplates(client: DBClient) {
  return client
    .from("overlay_templates")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
}

/**
 * One template plus its items. Items come back in sort_order so the caller can
 * rely on index-to-item alignment when it wires up widget templates afterwards.
 */
export async function getOverlayTemplateBySlug(client: DBClient, slug: string) {
  const { data: template, error: templateError } = await client
    .from("overlay_templates")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (templateError) return { template: null, items: null, error: templateError };
  if (!template) return { template: null, items: null, error: null };

  const { data: items, error: itemsError } = await client
    .from("overlay_template_items")
    .select("*")
    .eq("template_id", template.id)
    .order("sort_order", { ascending: true });

  if (itemsError) return { template: null, items: null, error: itemsError };
  return { template, items: items ?? [], error: null };
}

/** Published widget templates, also shown as the library's Starters tab. */
export async function getWidgetTemplates(client: DBClient) {
  return client
    .from("overlay_widget_templates")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
}

export async function getWidgetTemplateById(client: DBClient, id: string) {
  return client.from("overlay_widget_templates").select("*").eq("id", id).eq("is_published", true).maybeSingle();
}

export async function getWidgetTemplateBySlug(client: DBClient, slug: string) {
  return client.from("overlay_widget_templates").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
}

/** Widget templates referenced by an overlay template's items. */
export async function getWidgetTemplatesByIds(client: DBClient, ids: string[]) {
  return client.from("overlay_widget_templates").select("*").in("id", ids).eq("is_published", true);
}
