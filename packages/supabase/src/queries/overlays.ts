import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;
type OverlaySceneInsert = Database["public"]["Tables"]["overlay_scenes"]["Insert"];
type OverlaySceneUpdate = Database["public"]["Tables"]["overlay_scenes"]["Update"];

export async function getOverlayScenes(client: DBClient, userId: string) {
  return client.from("overlay_scenes").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
}

export async function getOverlayScene(client: DBClient, id: string, userId: string) {
  const { data: scene, error: sceneError } = await client
    .from("overlay_scenes")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (sceneError) return { scene: null, items: null, error: sceneError };

  const { data: items, error: itemsError } = await client
    .from("overlay_items")
    .select("*")
    .eq("scene_id", id)
    .order("z_index", { ascending: true });

  if (itemsError) return { scene: null, items: null, error: itemsError };
  return { scene, items: items ?? [], error: null };
}

export async function getOverlaySceneBySlug(client: DBClient, slug: string) {
  const { data: scene, error: sceneError } = await client
    .from("overlay_scenes")
    .select("*")
    .eq("slug", slug)
    .single();

  if (sceneError) return { scene: null, items: null, error: sceneError };

  const { data: items, error: itemsError } = await client
    .from("overlay_items")
    .select("*")
    .eq("scene_id", scene.id)
    .order("z_index", { ascending: true });

  if (itemsError) return { scene: null, items: null, error: itemsError };
  return { scene, items: items ?? [], error: null };
}

export async function createOverlayScene(client: DBClient, payload: OverlaySceneInsert) {
  return client.from("overlay_scenes").insert(payload).select().single();
}

export async function updateOverlayScene(client: DBClient, id: string, userId: string, updates: OverlaySceneUpdate) {
  return client.from("overlay_scenes").update(updates).eq("id", id).eq("user_id", userId).select().single();
}

export async function deleteOverlayScene(client: DBClient, id: string, userId: string) {
  return client.from("overlay_scenes").delete().eq("id", id).eq("user_id", userId);
}

export async function getOverlayItems(client: DBClient, sceneId: string) {
  return client.from("overlay_items").select("id").eq("scene_id", sceneId);
}

export async function getActiveOverlaySceneBySlug(client: DBClient, slug: string) {
  return client
    .from("overlay_scenes")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
}

export async function getOverlaySceneRow(client: DBClient, id: string, userId: string) {
  return client
    .from("overlay_scenes")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
}

export async function getAllOverlayItemsByScene(client: DBClient, sceneId: string) {
  return client
    .from("overlay_items")
    .select("*")
    .eq("scene_id", sceneId)
    .order("z_index", { ascending: true });
}

/** Embed / OBS: load scene by UUID without enforcing `user_id`; any `is_active` state */
export async function getOverlaySceneByIdForEmbed(client: DBClient, sceneId: string) {
  return client.from("overlay_scenes").select("*").eq("id", sceneId).maybeSingle();
}

/** Same filters as getActiveOverlaySceneBySlug but `.maybeSingle()` — missing slug is not an error row */
export async function getActiveOverlaySceneBySlugMaybe(client: DBClient, slug: string) {
  return client
    .from("overlay_scenes")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
}

export async function getOverlayItemById(client: DBClient, itemId: string, sceneId: string) {
  return client
    .from("overlay_items")
    .select("*")
    .eq("id", itemId)
    .eq("scene_id", sceneId)
    .single();
}

export async function deleteOverlayItemsByIds(client: DBClient, ids: string[]) {
  return client.from("overlay_items").delete().in("id", ids);
}

export async function updateOverlayItemData(
  client: DBClient,
  id: string,
  data: Database["public"]["Tables"]["overlay_items"]["Update"]
) {
  return client.from("overlay_items").update(data).eq("id", id);
}

export async function insertOverlayItemsReturningIds(
  client: DBClient,
  items: Database["public"]["Tables"]["overlay_items"]["Insert"][]
) {
  return client.from("overlay_items").insert(items).select("id");
}

export async function insertOverlayItems(
  client: DBClient,
  items: Database["public"]["Tables"]["overlay_items"]["Insert"][]
) {
  return client.from("overlay_items").insert(items);
}

export async function getOverlaySceneBySubscriberToken(client: DBClient, token: string) {
  return client
    .from("overlay_scenes")
    .select("user_id")
    .eq("subscriber_token", token)
    .maybeSingle();
}

export async function getLatestSubscriberToken(client: DBClient, userId: string) {
  return client
    .from("overlay_scenes")
    .select("subscriber_token")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

/** Rotates the token that authorizes read-only overlay subscribers. */
export async function updateSceneSubscriberToken(
  client: DBClient,
  sceneId: string,
  userId: string,
  token: string,
) {
  return client
    .from("overlay_scenes")
    .update({ subscriber_token: token })
    .eq("id", sceneId)
    .eq("user_id", userId);
}
