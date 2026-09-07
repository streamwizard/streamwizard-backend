"use client";

import { memo, useEffect, useRef, useState } from "react";
import { asCustomWidgetConfig } from "@/types/overlays";
import type { CustomWidgetItemConfig } from "@/types/overlays";
import type { OverlayCanvasProps } from "../../registry/overlay-widget-registry.types";
import { getOrCreateWidgetInstance } from "@/actions/widgets";
import { useOverlayStore } from "@/stores/overlay-editor-store";
import { fetchWidget } from "./widget-cache";
import {
  CustomWidgetIframe,
  buildWidgetSrcdoc,
  mergeFieldValues,
  resolveWidgetTemplate,
} from "@repo/ui/overlay";
import type { CustomWidgetIframeHandle, WidgetFieldSchema } from "@repo/ui/overlay";
import { env } from "@/lib/env";

/**
 * Reloading the document restarts the widget's script, so a slider drag waits
 * for the value to settle. Only widgets that ignore 'onFieldsUpdate' get this
 * far -- the rest already updated in place on the first tick.
 */
const PREVIEW_RELOAD_DEBOUNCE_MS = 300;

interface WidgetSource {
  html: string;
  js: string;
  extra_css: string;
  fields: WidgetFieldSchema;
}

function CustomWidgetCanvasInner({ item, scene }: OverlayCanvasProps) {
  const cfg = asCustomWidgetConfig(item.config);
  const [source, setSource] = useState<WidgetSource | null>(null);
  // Values saved before they moved into the item config. Only consulted while
  // the config carries none of its own.
  const [legacyValues, setLegacyValues] = useState<Record<string, unknown>>({});
  const [srcdoc, setSrcdoc] = useState<string | null>(null);
  const [fieldData, setFieldData] = useState<Record<string, unknown>>({});
  const [reloadToken, setReloadToken] = useState(0);
  const iframeRef = useRef<CustomWidgetIframeHandle>(null);
  // Set by the widget's reply to the last push. Widgets that re-apply settings
  // themselves never need the reload.
  const appliedInPlaceRef = useRef(false);

  // Config objects are replaced rather than mutated, so this identity only
  // changes when a setting actually changes.
  const fieldValues = cfg.field_values ?? legacyValues;
  const hasBuiltRef = useRef(false);

  useEffect(() => {
    if (!cfg.widget_id) return;
    let cancelled = false;

    async function load() {
      const widget = await fetchWidget(cfg.widget_id);
      if (cancelled || !widget) return;

      if (!cfg.field_values && item.id && !item.id.startsWith("temp-")) {
        const { data: instance } = await getOrCreateWidgetInstance(item.id, cfg.widget_id);
        if (cancelled) return;
        if (instance) setLegacyValues(instance.field_values ?? {});
      }

      hasBuiltRef.current = false;
      setSource({
        html: widget.html,
        js: widget.js,
        extra_css: widget.extra_css,
        fields: widget.fields,
      });
    }

    load();
    return () => { cancelled = true; };
  // cfg.field_values is read only to decide whether the legacy instance row is
  // worth fetching; re-running the load when a setting changes would reload the
  // widget on every edit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.widget_id, item.id]);

  useEffect(() => {
    if (!source) return;
    const values = fieldValues;

    function build() {
      if (!source) return;
      hasBuiltRef.current = true;
      setSrcdoc(
        buildWidgetSrcdoc(
          source.html,
          source.js,
          source.extra_css,
          source.fields,
          values,
          env.NEXT_PUBLIC_OVERLAY_URL,
          env.NEXT_PUBLIC_ASSET_CDN_URL
        )
      );
    }

    // Push the new values at the running document first: that's what updates a
    // widget whose settings only exist inside its own script, where the
    // generated document is byte-identical and a rebuild changes nothing.
    appliedInPlaceRef.current = false;
    setFieldData(mergeFieldValues(source.fields, values));

    // Nothing on screen yet — no state to preserve, so paint immediately.
    if (!hasBuiltRef.current) {
      build();
      return;
    }

    // CSS lands in place; HTML `{{key}}` substitutions need the new document.
    const { resolvedCss } = resolveWidgetTemplate(
      source.html,
      source.extra_css,
      source.fields,
      values
    );
    iframeRef.current?.postMessage({ type: "swPatchCss", css: resolvedCss });

    const timer = setTimeout(() => {
      // The widget re-applied the values itself, so leave its state alone.
      if (appliedInPlaceRef.current) return;
      build();
      // A JS-only field leaves the document unchanged, so setSrcdoc bails out
      // and the iframe never reloads on its own.
      setReloadToken((n) => n + 1);
    }, PREVIEW_RELOAD_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [source, fieldValues]);

  // Demo mode fan-out. Subscribed transiently rather than through the hook so a
  // 1 Hz simulator doesn't re-render every widget on the canvas each tick --
  // which also keeps it independent of this component's memo comparator.
  useEffect(
    () =>
      useOverlayStore.subscribe((state, prev) => {
        const demo = state.demoEvent;
        if (!demo || demo.seq === prev.demoEvent?.seq) return;
        iframeRef.current?.postMessage({
          type: "onEventReceived",
          payload: { listener: demo.listener, event: demo.event },
        });
      }),
    []
  );

  if (!cfg.widget_id) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-indigo-500/10">
        <p className="text-xs text-white/50 px-2 text-center">
          No widget selected — pick one in the inspector
        </p>
      </div>
    );
  }

  if (!srcdoc) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-indigo-500/10">
        <p className="text-xs text-white/40">Loading…</p>
      </div>
    );
  }

  return (
    <CustomWidgetIframe
      ref={iframeRef}
      srcdoc={srcdoc}
      fieldData={fieldData}
      reloadToken={reloadToken}
      onFieldDataApplied={(handled) => { appliedInPlaceRef.current = handled; }}
      subscriberToken={scene.subscriber_token}
      overlayItemId={item.id}
      className="w-full h-full"
      style={{ pointerEvents: "none" }}
      tabIndex={-1}
      title="custom widget preview"
    />
  );
}

export const CustomWidgetCanvas = memo(
  CustomWidgetCanvasInner,
  (prev, next) => {
    const prevCfg = prev.item.config as CustomWidgetItemConfig;
    const nextCfg = next.item.config as CustomWidgetItemConfig;
    return (
      prev.item.id === next.item.id &&
      prevCfg.widget_id === nextCfg.widget_id &&
      prevCfg.instance_id === nextCfg.instance_id &&
      JSON.stringify(prevCfg.field_values) === JSON.stringify(nextCfg.field_values)
    );
  }
);
