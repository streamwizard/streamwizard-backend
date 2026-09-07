"use server";

import { supabaseAdmin } from "@repo/supabase/next/admin";
import { reportError } from "@repo/sentry";
import type { WidgetFieldSchema } from "@repo/ui/overlay";

export interface CustomWidgetData {
  html: string;
  js: string;
  extra_css: string;
  fields: WidgetFieldSchema;
  field_values: Record<string, unknown>;
}

/**
 * `fieldValues` comes from the overlay item's config, which the scene payload
 * already carries. The instance row is only queried for items saved before
 * field values moved into the config.
 */
export async function loadCustomWidgetData(
  widgetId: string,
  ownerUserId: string,
  instanceId?: string,
  fieldValues?: Record<string, unknown>
): Promise<{ data: CustomWidgetData | null; error: string | null }> {
  const needsInstance = fieldValues === undefined && Boolean(instanceId);
  const [{ data: widget, error: wErr }, { data: instance, error: iErr }] = await Promise.all([
    supabaseAdmin
      .from("overlay_widgets")
      .select("html, js, extra_css, fields")
      .eq("id", widgetId)
      .eq("user_id", ownerUserId)
      .single(),
    needsInstance
      ? supabaseAdmin
          .from("overlay_widget_instances")
          .select("field_values")
          .eq("id", instanceId!)
          .eq("user_id", ownerUserId)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  // PGRST116 = .single() matched no rows — a missing/deleted widget or
  // instance is a config state, not a failure worth reporting.
  if (wErr && wErr.code !== "PGRST116") {
    reportError(wErr, "custom-widget.loadCustomWidgetData: widget query");
  }
  if (iErr && iErr.code !== "PGRST116") {
    reportError(iErr, "custom-widget.loadCustomWidgetData: instance query");
  }

  if (wErr || !widget) return { data: null, error: wErr?.message ?? "Widget not found" };

  return {
    data: {
      html: widget.html,
      js: widget.js,
      extra_css: widget.extra_css,
      fields: (widget.fields ?? {}) as unknown as WidgetFieldSchema,
      field_values:
        fieldValues ??
        (((instance as { field_values: unknown } | null)?.field_values ?? {}) as Record<string, unknown>),
    },
    error: null,
  };
}
