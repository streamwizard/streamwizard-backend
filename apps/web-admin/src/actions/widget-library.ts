"use server";

import { reportError } from "@repo/sentry";

import { assertAdmin } from "@/lib/assert-admin";
import { createAdminClient } from "@repo/supabase/next/admin";
import { revalidatePath } from "next/cache";
import type { WidgetFieldSchema } from "@repo/ui/overlay";

const WIDGET_LIBRARY_PATH = "/widget-library";

async function requireAdminContext() {
  await assertAdmin();
  return createAdminClient();
}

export interface Widget {
  id: string;
  user_id: string;
  name: string;
  description: string;
  html: string;
  js: string;
  extra_css: string;
  fields: WidgetFieldSchema;
  preview_url: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface WidgetLibraryEntry {
  id: string;
  widget_id: string;
  user_id: string;
  title: string;
  description: string;
  tags: string[];
  likes: number;
  installs: number;
  is_approved: boolean;
  created_at: string;
}

export async function getPendingLibraryEntries() {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { data: null, error: "Forbidden" };
  }
  const { data, error } = await adminClient
    .from("overlay_widget_library_entries")
    .select("*, overlay_widgets(*)")
    .eq("is_approved", false)
    .order("created_at", { ascending: true });
  if (error) reportError(error, "actions/widget-library");
  return { data, error: error?.message ?? null };
}

export async function approveLibraryEntry(entryId: string) {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { error: "Forbidden" };
  }
  const { error } = await adminClient
    .from("overlay_widget_library_entries")
    .update({ is_approved: true })
    .eq("id", entryId);
  revalidatePath(WIDGET_LIBRARY_PATH);
  if (error) reportError(error, "actions/widget-library");
  return { error: error?.message ?? null };
}

export async function rejectLibraryEntry(entryId: string) {
  let adminClient;
  try {
    adminClient = await requireAdminContext();
  } catch {
    return { error: "Forbidden" };
  }
  const { error } = await adminClient
    .from("overlay_widget_library_entries")
    .delete()
    .eq("id", entryId);
  revalidatePath(WIDGET_LIBRARY_PATH);
  if (error) reportError(error, "actions/widget-library");
  return { error: error?.message ?? null };
}
