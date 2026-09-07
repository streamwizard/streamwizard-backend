"use client";

import { useEffect, useState } from "react";
import type { OverlayWidgetProps } from "@repo/ui/overlay";
import { CustomWidgetIframe, buildWidgetSrcdoc, mergeFieldValues } from "@repo/ui/overlay";
import { loadCustomWidgetData } from "@/actions/custom-widget";
import { env } from "@/lib/env";

interface CustomWidgetConfig {
  widget_id: string;
  instance_id: string;
  field_values?: Record<string, unknown>;
}

export function CustomWidgetContainer({ scene, item }: OverlayWidgetProps) {
  const cfg = item.config as unknown as CustomWidgetConfig;
  const [srcdoc, setSrcdoc] = useState("");
  const [fieldData, setFieldData] = useState<Record<string, unknown>>({});
  // Serialized so a fresh scene payload with identical settings doesn't reload
  // the widget and wipe its runtime state.
  const fieldValuesKey = JSON.stringify(cfg.field_values ?? null);

  useEffect(() => {
    if (!cfg.widget_id) return;

    let cancelled = false;
    const fieldValues = JSON.parse(fieldValuesKey) as Record<string, unknown> | null;

    loadCustomWidgetData(cfg.widget_id, scene.user_id, cfg.instance_id || undefined, fieldValues ?? undefined).then(
      ({ data, error }) => {
        if (cancelled) return;
        if (!data) {
          console.error("[CustomWidget] failed to load widget", cfg.widget_id, error);
          return;
        }
        setFieldData(mergeFieldValues(data.fields, data.field_values));
        setSrcdoc(buildWidgetSrcdoc(data.html, data.js, data.extra_css, data.fields, data.field_values, env.NEXT_PUBLIC_OVERLAY_URL, env.NEXT_PUBLIC_ASSET_CDN_URL));
      }
    );

    return () => { cancelled = true; };
  }, [cfg.widget_id, cfg.instance_id, fieldValuesKey, scene.user_id]);

  if (!srcdoc) return null;

  return (
    <CustomWidgetIframe
      srcdoc={srcdoc}
      fieldData={fieldData}
      userId={scene.user_id}
      subscriberToken={scene.subscriber_token}
      overlayItemId={item.id}
      style={{ width: "100%", height: "100%" }}
      title="custom-widget"
    />
  );
}
