"use server";

import { reportError } from "@repo/sentry";
import { R2Storage } from "@repo/storage";
import { getUserAssetQuotaMb } from "@repo/supabase/queries/subscriptions";
import { createAdminClient } from "@repo/supabase/next/admin";
import { revalidatePath } from "next/cache";

import {
  deleteUserAsset,
  insertUserAsset,
  markAssetReady,
  selectAllAssetKeys,
  selectPendingAssetSizes,
  selectReadyAssets,
  selectStalePendingAssets,
  selectStorageUsage,
  selectUserAsset,
} from "@repo/supabase/queries/assets";

import { tryAuthContext, type AuthContext } from "@/lib/auth";
import { env } from "@/lib/env";

// Media library: streamer-uploaded overlay assets (alert images/sounds/videos)
// stored in Cloudflare R2. Upload flow is presign -> browser PUT -> confirm:
// createAssetUpload checks quota and mints a presigned PUT, the client uploads
// directly to R2, confirmAssetUpload verifies the object via HeadObject and
// records its exact size. Only confirmed ('ready') rows count toward usage;
// pending rows younger than an hour reserve quota so parallel uploads can't
// oversubscribe it.

const FREE_QUOTA_MB = 100;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const PENDING_RESERVATION_MS = 60 * 60 * 1000;
const PRESIGN_EXPIRY_SECONDS = 300;

export type AssetKind = "image" | "audio" | "video" | "lottie";

export interface UserAsset {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  kind: AssetKind;
  url: string;
  created_at: string;
}

export interface AssetListing {
  files: UserAsset[];
  used_bytes: number;
  quota_bytes: number;
}

function getR2(): R2Storage {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_ASSETS_BUCKET) {
    throw new Error("Media storage is not configured on this environment.");
  }
  return new R2Storage({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_ASSETS_BUCKET,
  });
}

function assetUrl(key: string): string {
  if (!env.NEXT_PUBLIC_ASSET_CDN_URL) throw new Error("Media storage is not configured on this environment.");
  return `${env.NEXT_PUBLIC_ASSET_CDN_URL.replace(/\/$/, "")}/${key}`;
}

// Explicit allowlist — never prefix-match. image/svg+xml is deliberately
// excluded: SVG can carry <script> and the CDN domain is same-site with the
// dashboard, so a stored SVG would be a stored-XSS vector. The Content-Type is
// part of the presigned signature, so clients can't swap it after this check.
const MIME_TO_KIND: Record<string, AssetKind> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/avif": "image",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/ogg": "audio",
  "audio/webm": "audio",
  "video/mp4": "video",
  "video/webm": "video",
  "application/json": "lottie",
};

function kindFromMime(mime: string): AssetKind | null {
  return MIME_TO_KIND[mime] ?? null;
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  return cleaned.slice(0, 128) || "file";
}

async function getQuotaBytes(supabase: AuthContext["supabase"], userId: string): Promise<number> {
  const planQuotaMb = await getUserAssetQuotaMb(supabase, userId);
  return (planQuotaMb ?? FREE_QUOTA_MB) * 1024 * 1024;
}

async function getUsedBytes(
  supabase: AuthContext["supabase"],
  userId: string,
  opts: { includePending: boolean },
): Promise<number> {
  const { data: usage } = await selectStorageUsage(supabase, userId);
  let used = usage?.used_bytes ?? 0;

  if (opts.includePending) {
    const cutoff = new Date(Date.now() - PENDING_RESERVATION_MS).toISOString();
    const { data: pending } = await selectPendingAssetSizes(supabase, userId, cutoff);
    used += (pending ?? []).reduce((sum, row) => sum + row.size_bytes, 0);
  }
  return used;
}

export async function listAssets(): Promise<{ data: AssetListing | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  const { supabase, user } = ctx;

  const { data, error } = await selectReadyAssets(supabase, user.id);
  if (error) {
    reportError(error, "actions/assets");
    return { data: null, error: "Failed to load your media." };
  }

  try {
    const [used_bytes, quota_bytes] = await Promise.all([
      getUsedBytes(supabase, user.id, { includePending: false }),
      getQuotaBytes(supabase, user.id),
    ]);
    return {
      data: {
        files: (data ?? []).map((row) => ({
          id: row.id,
          file_name: row.file_name,
          mime_type: row.mime_type,
          size_bytes: row.size_bytes,
          kind: row.kind as AssetKind,
          url: assetUrl(row.key),
          created_at: row.created_at,
        })),
        used_bytes,
        quota_bytes,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to load your media." };
  }
}

export async function createAssetUpload(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{ data: { assetId: string; uploadUrl: string; url: string } | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  const { supabase, user } = ctx;

  const kind = kindFromMime(input.mimeType);
  if (!kind) return { data: null, error: "That file type isn't supported. Upload an image, sound, or video." };
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { data: null, error: "Can't read that file's size." };
  }
  if (input.sizeBytes > MAX_FILE_BYTES) {
    return { data: null, error: "Files can be up to 100MB." };
  }

  try {
    const r2 = getR2();
    const [used, quota] = await Promise.all([
      getUsedBytes(supabase, user.id, { includePending: true }),
      getQuotaBytes(supabase, user.id),
    ]);
    if (used + input.sizeBytes > quota) {
      return { data: null, error: "Not enough storage left. Delete something or upgrade your plan." };
    }

    const fileName = sanitizeFileName(input.fileName);
    const assetId = crypto.randomUUID();
    const key = `assets/${user.id}/${assetId}/${fileName}`;

    const { error: insertError } = await insertUserAsset(supabase, {
      id: assetId,
      user_id: user.id,
      key,
      file_name: fileName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      kind,
      status: "pending",
    });
    if (insertError) {
      reportError(insertError, "actions/assets");
      return { data: null, error: "Failed to start the upload." };
    }

    const uploadUrl = await r2.presignPut(key, input.mimeType, PRESIGN_EXPIRY_SECONDS);
    return { data: { assetId, uploadUrl, url: assetUrl(key) }, error: null };
  } catch (err) {
    reportError(err, "actions/assets");
    return { data: null, error: err instanceof Error ? err.message : "Failed to start the upload." };
  }
}

export async function confirmAssetUpload(
  assetId: string,
): Promise<{ data: AssetListing | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  const { supabase, user } = ctx;

  const { data: asset } = await selectUserAsset(supabase, assetId, user.id);
  if (!asset) return { data: null, error: "Upload not found." };

  try {
    if (asset.status !== "ready") {
      const head = await getR2().headObject(asset.key);
      if (!head) {
        await deleteUserAsset(supabase, asset.id);
        return { data: null, error: "The upload didn't finish. Try again." };
      }
      // HeadObject is the source of truth for size — never the client's claim.
      const { error: updateError } = await markAssetReady(supabase, asset.id, head.size);
      if (updateError) {
        reportError(updateError, "actions/assets");
        return { data: null, error: "Failed to finish the upload." };
      }
    }
    revalidatePath("/dashboard/media");
    return listAssets();
  } catch (err) {
    reportError(err, "actions/assets");
    return { data: null, error: "Failed to finish the upload." };
  }
}

export async function deleteAsset(assetId: string): Promise<{ data: AssetListing | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  const { supabase, user } = ctx;

  const { data: asset } = await selectUserAsset(supabase, assetId, user.id);
  if (!asset) return { data: null, error: "File not found." };

  try {
    await getR2().deleteObject(asset.key);
    const { error: deleteError } = await deleteUserAsset(supabase, asset.id);
    if (deleteError) {
      reportError(deleteError, "actions/assets");
      return { data: null, error: "Failed to delete the file." };
    }
    revalidatePath("/dashboard/media");
    return listAssets();
  } catch (err) {
    reportError(err, "actions/assets");
    return { data: null, error: "Failed to delete the file." };
  }
}

/**
 * Admin hygiene: drops abandoned pending rows (older than the reservation
 * window) and deletes R2 objects that no longer have a DB row. Safe to run
 * repeatedly; intended for a cron or manual admin trigger.
 */
export async function reconcileAssets(): Promise<{
  data: { removedPending: number; removedOrphans: number } | null;
  error: string | null;
}> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  if (ctx.user.app_metadata?.is_admin !== true) return { data: null, error: "Forbidden" };

  try {
    const admin = createAdminClient();
    const r2 = getR2();
    const cutoff = new Date(Date.now() - PENDING_RESERVATION_MS).toISOString();

    const { data: stale } = await selectStalePendingAssets(admin, cutoff);
    for (const row of stale ?? []) {
      // The object may exist if the client uploaded but never confirmed.
      await r2.deleteObject(row.key).catch(() => {});
      await deleteUserAsset(admin, row.id);
    }

    const { data: allRows } = await selectAllAssetKeys(admin);
    const known = new Set((allRows ?? []).map((row) => row.key));
    const objects = await r2.listPrefix("assets/");
    let removedOrphans = 0;
    for (const obj of objects) {
      if (!known.has(obj.key)) {
        await r2.deleteObject(obj.key);
        removedOrphans += 1;
      }
    }

    return { data: { removedPending: (stale ?? []).length, removedOrphans }, error: null };
  } catch (err) {
    reportError(err, "actions/assets");
    return { data: null, error: "Reconcile failed." };
  }
}
