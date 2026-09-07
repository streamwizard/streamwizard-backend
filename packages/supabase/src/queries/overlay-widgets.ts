import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../types/supabase";

/** Everything that touches the custom-widget tables: widgets, their per-item
 *  instances, and the shared library entries. */

type DBClient = SupabaseClient<Database>;
type OverlayWidgetInsert = Database["public"]["Tables"]["overlay_widgets"]["Insert"];
type OverlayWidgetUpdate = Database["public"]["Tables"]["overlay_widgets"]["Update"];
type OverlayWidgetInstanceInsert = Database["public"]["Tables"]["overlay_widget_instances"]["Insert"];

export type OverlayWidgetRow = Database["public"]["Tables"]["overlay_widgets"]["Row"];

/** The copyable part of a widget — what "install" or "fork" duplicates. */
export interface OverlayWidgetSource {
  name: string;
  description: string;
  html: string;
  js: string;
  extra_css: string;
  fields: unknown;
  tags: string[];
}

export function overlayWidgetColumns(source: OverlayWidgetSource, userId: string): OverlayWidgetInsert {
  return {
    user_id: userId,
    name: source.name,
    description: source.description,
    html: source.html,
    js: source.js,
    extra_css: source.extra_css,
    fields: source.fields as Json,
    tags: source.tags,
  };
}

export async function selectOverlayWidgets(client: DBClient, userId: string) {
  return client
    .from("overlay_widgets")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
}

export async function selectOverlayWidget(client: DBClient, id: string, userId: string) {
  return client.from("overlay_widgets").select("*").eq("id", id).eq("user_id", userId).single();
}

export async function selectOverlayWidgetsByIds(client: DBClient, userId: string, ids: string[]) {
  return client.from("overlay_widgets").select("*").eq("user_id", userId).in("id", ids);
}

export async function insertOverlayWidget(client: DBClient, payload: OverlayWidgetInsert) {
  return client.from("overlay_widgets").insert(payload).select().single();
}

export async function updateOverlayWidget(
  client: DBClient,
  id: string,
  userId: string,
  updates: OverlayWidgetUpdate,
) {
  return client.from("overlay_widgets").update(updates).eq("id", id).eq("user_id", userId);
}

export async function deleteOverlayWidget(client: DBClient, id: string, userId: string) {
  return client.from("overlay_widgets").delete().eq("id", id).eq("user_id", userId);
}

export async function selectWidgetInstanceByItem(client: DBClient, overlayItemId: string, userId: string) {
  return client
    .from("overlay_widget_instances")
    .select("*")
    .eq("overlay_item_id", overlayItemId)
    .eq("user_id", userId)
    .single();
}

/** Per-item widget state (field values, runtime state) for one placed widget. */
export async function insertOverlayWidgetInstance(client: DBClient, payload: OverlayWidgetInstanceInsert) {
  return client.from("overlay_widget_instances").insert(payload).select().single();
}

/**
 * The whole approved library; callers filter client-side. Deliberately takes no
 * search argument — a server-side filter belongs in bound `.ilike()` calls or
 * `.textSearch()`, never in a string-built `.or()`, which lets the value rewrite
 * the filter (including the `is_approved` scoping).
 */
export async function selectApprovedLibraryEntries(client: DBClient) {
  return client
    .from("overlay_widget_library_entries")
    .select("*, overlay_widgets(*)")
    .eq("is_approved", true)
    .order("installs", { ascending: false });
}

export async function selectApprovedLibraryEntry(client: DBClient, entryId: string) {
  return client
    .from("overlay_widget_library_entries")
    .select("*, overlay_widgets(*)")
    .eq("id", entryId)
    .eq("is_approved", true)
    .single();
}

export async function insertLibraryEntry(
  client: DBClient,
  entry: { widget_id: string; user_id: string; title: string; description: string; tags: string[] },
) {
  return client.from("overlay_widget_library_entries").insert({ ...entry, is_approved: false });
}

export async function incrementWidgetInstalls(client: DBClient, entryId: string) {
  return client.rpc("increment_widget_installs", { entry_id: entryId });
}
