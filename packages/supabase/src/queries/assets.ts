import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";
import { withMetrics } from "./with-metrics";

/** Media-library rows: streamer-uploaded overlay assets and their storage usage. */

type DBClient = SupabaseClient<Database>;
type UserAssetInsert = Database["public"]["Tables"]["user_assets"]["Insert"];

export const selectStorageUsage = withMetrics(
  "user_storage_usage",
  "select",
  async (client: DBClient, userId: string) =>
    client.from("user_storage_usage").select("used_bytes").eq("user_id", userId).maybeSingle(),
);

/**
 * Pending uploads newer than `cutoff` still reserve quota — otherwise parallel
 * uploads could each pass the quota check and collectively blow past it.
 */
export const selectPendingAssetSizes = withMetrics(
  "user_assets",
  "select",
  async (client: DBClient, userId: string, cutoff: string) =>
    client
      .from("user_assets")
      .select("size_bytes")
      .eq("user_id", userId)
      .eq("status", "pending")
      .gte("created_at", cutoff),
);

export const selectReadyAssets = withMetrics(
  "user_assets",
  "select",
  async (client: DBClient, userId: string) =>
    client
      .from("user_assets")
      .select("id, key, file_name, mime_type, size_bytes, kind, created_at")
      .eq("user_id", userId)
      .eq("status", "ready")
      .order("created_at", { ascending: false }),
);

export const selectUserAsset = withMetrics(
  "user_assets",
  "select",
  async (client: DBClient, assetId: string, userId: string) =>
    client.from("user_assets").select("id, key, status").eq("id", assetId).eq("user_id", userId).maybeSingle(),
);

export const insertUserAsset = withMetrics(
  "user_assets",
  "insert",
  async (client: DBClient, payload: UserAssetInsert) => client.from("user_assets").insert(payload),
);

export const markAssetReady = withMetrics(
  "user_assets",
  "update",
  async (client: DBClient, assetId: string, sizeBytes: number) =>
    client.from("user_assets").update({ size_bytes: sizeBytes, status: "ready" }).eq("id", assetId),
);

export const deleteUserAsset = withMetrics(
  "user_assets",
  "delete",
  async (client: DBClient, assetId: string) => client.from("user_assets").delete().eq("id", assetId),
);

/** Admin reconcile: pending rows abandoned before `cutoff`. */
export const selectStalePendingAssets = withMetrics(
  "user_assets",
  "select",
  async (client: DBClient, cutoff: string) =>
    client.from("user_assets").select("id, key").eq("status", "pending").lt("created_at", cutoff),
);

/** Admin reconcile: every known object key, to spot orphans in the bucket. */
export const selectAllAssetKeys = withMetrics(
  "user_assets",
  "select",
  async (client: DBClient) => client.from("user_assets").select("key"),
);
