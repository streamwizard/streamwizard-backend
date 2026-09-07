"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildWidgetSrcdoc,
  flattenFieldSchema,
  mergeFieldValues,
  resolveWidgetTemplate,
  type CustomWidgetIframeHandle,
  type WidgetFieldSchema,
} from "@repo/ui/overlay";
import type { Widget } from "@/actions/widgets";
import { env } from "@/lib/env";
import { coerceFields } from "@/components/widgets/editor/widget-editor-fields";
import { parseFieldsJson, type WidgetSources } from "@/hooks/widgets/use-widget-draft";

/** Console/error mirroring is editor-only — overlays don't need the traffic. */
const SRCDOC_OPTS = { forwardLogs: true } as const;

export type EditorTab = "html" | "js" | "fields" | "css";

/** How long to sit on a keystroke before rebuilding, per tab. */
const HOT_RELOAD_DELAY_MS: Record<EditorTab, number> = {
  css: 250,
  html: 600,
  fields: 600,
  // Reloading JS costs the widget all its state, so mid-expression rebuilds are
  // pure noise — wait until the author has actually stopped typing.
  js: 1000,
};

/**
 * The live preview: the sandboxed document, the field values feeding it, and
 * the debounced hot-reload that rebuilds it as the author types.
 *
 * CSS is special-cased — it's patched into the running document instead of
 * remounting it, so an animation being debugged doesn't restart on every edit.
 */
export function useWidgetPreview({ widget, sources }: { widget: Widget; sources: WidgetSources }) {
  const widgetRef = useRef<CustomWidgetIframeHandle>(null);
  const hotReloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  const [srcdoc, setSrcdoc] = useState(() => {
    const fields = coerceFields(widget.fields as WidgetFieldSchema);
    const defaults = mergeFieldValues(fields, {});
    return buildWidgetSrcdoc(
      widget.html,
      widget.js,
      widget.extra_css,
      fields,
      defaults,
      undefined,
      env.NEXT_PUBLIC_ASSET_CDN_URL,
      SRCDOC_OPTS,
    );
  });
  const [fieldData, setFieldData] = useState<Record<string, unknown>>(() => {
    const fields = coerceFields(widget.fields as WidgetFieldSchema);
    return mergeFieldValues(fields, {});
  });
  // Schema mirror of the Fields tab, so the field panel can render without
  // reparsing the JSON on every keystroke.
  const [fieldsSchema, setFieldsSchema] = useState<WidgetFieldSchema>(() =>
    coerceFields(widget.fields as WidgetFieldSchema),
  );
  // Editor-session-only values the author is trying out, keyed by field.
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, unknown>>({});
  // Mirrored so the debounced hot-reload timer doesn't act on a stale closure.
  const fieldOverridesRef = useRef(fieldOverrides);
  useEffect(() => {
    fieldOverridesRef.current = fieldOverrides;
  }, [fieldOverrides]);
  // Mirror of the JS source for the demo panel's listener scan, refreshed with
  // the preview rather than on every keystroke.
  const [jsSource, setJsSource] = useState(widget.js);

  function refreshPreview(overrideValues?: Record<string, unknown>) {
    const fields = parseFieldsJson(sources) ?? (widget.fields as WidgetFieldSchema);
    // Renaming or deleting a field in the JSON must drop its stale override.
    const source = overrideValues ?? fieldOverridesRef.current;
    const overrides: Record<string, unknown> = {};
    for (const key of Object.keys(flattenFieldSchema(fields))) {
      if (key in source) overrides[key] = source[key];
    }

    setFieldsSchema(fields);
    setFieldOverrides(overrides);
    fieldOverridesRef.current = overrides;
    setFieldData(mergeFieldValues(fields, overrides));
    setSrcdoc(
      buildWidgetSrcdoc(
        sources.html.current,
        sources.js.current,
        sources.css.current,
        fields,
        overrides,
        undefined,
        env.NEXT_PUBLIC_ASSET_CDN_URL,
        SRCDOC_OPTS,
      ),
    );
    setJsSource(sources.js.current);
    setRefreshKey((k) => k + 1);
  }

  function setFieldOverride(key: string, value: unknown) {
    // Field values feed both {{placeholder}} substitution in the HTML/CSS and
    // the fieldData handed to JS, so the document has to be rebuilt.
    refreshPreview({ ...fieldOverridesRef.current, [key]: value });
  }

  /** Swaps author CSS in the running document — no remount, no lost state. */
  function patchPreviewCss() {
    const fields = parseFieldsJson(sources) ?? fieldsSchema;
    const { resolvedCss } = resolveWidgetTemplate("", sources.css.current, fields, fieldOverridesRef.current);
    widgetRef.current?.postMessage({ type: "swPatchCss", css: resolvedCss });
  }

  /**
   * Debounced rebuild after a keystroke. CSS is patched into the running
   * document instead of remounting it, so an animation being debugged doesn't
   * restart on every edit.
   */
  function scheduleHotReload(tab: EditorTab) {
    if (hotReloadTimer.current) clearTimeout(hotReloadTimer.current);
    hotReloadTimer.current = setTimeout(
      tab === "css" ? patchPreviewCss : refreshPreview,
      HOT_RELOAD_DELAY_MS[tab],
    );
  }

  /** Fires a fake overlay event at the running widget (demo panel). */
  function fireTestEvent(listener: string, event: Record<string, unknown>) {
    widgetRef.current?.postMessage({ type: "onEventReceived", payload: { listener, event } });
  }

  return {
    widgetRef,
    refreshKey,
    srcdoc,
    fieldData,
    fieldsSchema,
    fieldOverrides,
    jsSource,
    refreshPreview,
    setFieldOverride,
    scheduleHotReload,
    fireTestEvent,
  };
}
