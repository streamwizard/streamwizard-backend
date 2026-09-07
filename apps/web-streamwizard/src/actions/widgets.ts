"use server";

import { revalidatePath } from "next/cache";
import { reportError } from "@repo/sentry";
import {
  getWidgetTemplates as getWidgetTemplateRows,
  getWidgetTemplateById,
} from "@repo/supabase/queries/overlay-templates";
import {
  deleteOverlayWidget,
  incrementWidgetInstalls,
  insertLibraryEntry,
  insertOverlayWidget,
  insertOverlayWidgetInstance,
  overlayWidgetColumns,
  selectApprovedLibraryEntries,
  selectApprovedLibraryEntry,
  selectOverlayWidget,
  selectOverlayWidgets,
  selectOverlayWidgetsByIds,
  selectWidgetInstanceByItem,
  updateOverlayWidget,
} from "@repo/supabase/queries/overlay-widgets";
import type { WidgetFieldSchema } from "@repo/ui/overlay";
import { tryAuthContext } from "@/lib/auth";

const ERROR_SCOPE = "actions/widgets";

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

export interface OverlayWidgetInstance {
  id: string;
  overlay_item_id: string;
  widget_id: string;
  user_id: string;
  field_values: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// --- Widget CRUD ---

export async function getWidgets() {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };

  const { data, error } = await selectOverlayWidgets(ctx.supabase, ctx.user.id);
  if (error) reportError(error, ERROR_SCOPE);
  return { data: data as unknown as Widget[] | null, error: error?.message ?? null };
}

export async function getWidget(id: string) {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };

  const { data, error } = await selectOverlayWidget(ctx.supabase, id, ctx.user.id);
  if (error) reportError(error, ERROR_SCOPE);
  return { data: data as unknown as Widget | null, error: error?.message ?? null };
}

/** Batch form of getWidget, for warming a whole scene's widgets in one trip. */
export async function getWidgetsByIds(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return { data: [] as Widget[], error: null };

  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };

  const { data, error } = await selectOverlayWidgetsByIds(ctx.supabase, ctx.user.id, unique);
  if (error) reportError(error, ERROR_SCOPE);
  return { data: data as unknown as Widget[] | null, error: error?.message ?? null };
}

export async function createWidget(input: {
  name: string;
  description?: string;
  html?: string;
  js?: string;
  extra_css?: string;
  fields?: WidgetFieldSchema;
  tags?: string[];
}) {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };

  const { data, error } = await insertOverlayWidget(
    ctx.supabase,
    overlayWidgetColumns(
      {
        name: input.name,
        description: input.description ?? "",
        html: input.html ?? "",
        js: input.js ?? "",
        extra_css: input.extra_css ?? "",
        fields: input.fields ?? {},
        tags: input.tags ?? [],
      },
      ctx.user.id,
    ),
  );
  revalidatePath("/dashboard/widget-library");
  if (error) reportError(error, ERROR_SCOPE);
  return { data: data as unknown as Widget | null, error: error?.message ?? null };
}

export async function updateWidget(
  id: string,
  updates: Partial<{
    name: string;
    description: string;
    html: string;
    js: string;
    extra_css: string;
    fields: WidgetFieldSchema;
    tags: string[];
  }>,
) {
  const ctx = await tryAuthContext();
  if (!ctx) return { error: "Unauthorized" };

  const { error } = await updateOverlayWidget(ctx.supabase, id, ctx.user.id, {
    ...updates,
    fields: updates.fields as never,
    updated_at: new Date().toISOString(),
  });
  if (error) reportError(error, ERROR_SCOPE);
  return { error: error?.message ?? null };
}

export async function deleteWidget(id: string) {
  const ctx = await tryAuthContext();
  if (!ctx) return { error: "Unauthorized" };

  const { error } = await deleteOverlayWidget(ctx.supabase, id, ctx.user.id);
  revalidatePath("/dashboard/widget-library");
  if (error) reportError(error, ERROR_SCOPE);
  return { error: error?.message ?? null };
}

// --- Overlay Widget Instances ---

export async function getOrCreateWidgetInstance(overlayItemId: string, widgetId: string) {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };

  const { data: existing } = await selectWidgetInstanceByItem(ctx.supabase, overlayItemId, ctx.user.id);
  if (existing) return { data: existing as OverlayWidgetInstance, error: null };

  const { data, error } = await insertOverlayWidgetInstance(ctx.supabase, {
    overlay_item_id: overlayItemId,
    widget_id: widgetId,
    user_id: ctx.user.id,
    field_values: {},
  });
  if (error) reportError(error, ERROR_SCOPE);
  return { data: data as unknown as OverlayWidgetInstance | null, error: error?.message ?? null };
}

// --- Library ---

export async function getApprovedLibraryEntries() {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };

  const { data, error } = await selectApprovedLibraryEntries(ctx.supabase);
  if (error) reportError(error, ERROR_SCOPE);
  return { data, error: error?.message ?? null };
}

export async function publishWidgetToLibrary(
  widgetId: string,
  input: { title: string; description: string; tags: string[] },
) {
  const ctx = await tryAuthContext();
  if (!ctx) return { error: "Unauthorized" };

  const { error } = await insertLibraryEntry(ctx.supabase, {
    widget_id: widgetId,
    user_id: ctx.user.id,
    title: input.title,
    description: input.description,
    tags: input.tags,
  });
  if (error) reportError(error, ERROR_SCOPE);
  return { error: error?.message ?? null };
}

export interface WidgetTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  tags: string[];
}

/**
 * Widget templates, shown as the library's Starters tab. Source (html/js/css/fields) is deliberately left
 * out — installing copies it server-side, so the client never needs it.
 */
export async function getWidgetTemplates() {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };

  const { data, error } = await getWidgetTemplateRows(ctx.supabase);
  if (error) {
    reportError(error, ERROR_SCOPE);
    return { data: null, error: error.message };
  }

  return {
    data: (data ?? []).map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      description: s.description,
      tags: s.tags,
    })) satisfies WidgetTemplate[],
    error: null,
  };
}

/** Copy a widget template into an `overlay_widgets` row the user owns and can edit. */
export async function installWidgetTemplate(templateId: string) {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };

  const { data: widgetTemplate, error: templateError } = await getWidgetTemplateById(ctx.supabase, templateId);
  if (templateError) {
    reportError(templateError, ERROR_SCOPE);
    return { data: null, error: templateError.message };
  }
  if (!widgetTemplate) return { data: null, error: "Widget template not found" };

  const { data: installed, error: installError } = await insertOverlayWidget(
    ctx.supabase,
    overlayWidgetColumns(widgetTemplate, ctx.user.id),
  );

  if (installError) {
    reportError(installError, ERROR_SCOPE);
    return { data: null, error: installError.message };
  }

  return { data: installed as unknown as Widget, error: null };
}

export async function installWidgetFromLibrary(entryId: string) {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };

  const { data: entry, error: entryError } = await selectApprovedLibraryEntry(ctx.supabase, entryId);

  if (entryError || !entry) {
    return { data: null, error: entryError?.message ?? "Entry not found" };
  }

  const source = (entry as unknown as { overlay_widgets: Widget }).overlay_widgets;

  const { data: forked, error: forkError } = await insertOverlayWidget(
    ctx.supabase,
    overlayWidgetColumns(source, ctx.user.id),
  );

  if (forkError) {
    reportError(forkError, ERROR_SCOPE);
    return { data: null, error: forkError.message };
  }

  await incrementWidgetInstalls(ctx.supabase, entryId);

  revalidatePath("/dashboard/widget-library");
  return { data: forked as unknown as Widget, error: null };
}
