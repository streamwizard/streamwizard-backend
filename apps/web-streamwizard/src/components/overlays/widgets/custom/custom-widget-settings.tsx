"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { asCustomWidgetConfig } from "@/types/overlays";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";
import { getWidgets, getOrCreateWidgetInstance } from "@/actions/widgets";
import type { Widget } from "@/actions/widgets";
import { Button } from "@repo/ui";
import { WidgetFieldList } from "./widget-field-input";
import { primeWidgetCache, useWidget } from "./widget-cache";

export function CustomWidgetSettings({
  item,
  updateItem,
}: OverlayInspectorAppendProps) {
  const cfg = asCustomWidgetConfig(item.config);
  const widget = useWidget(cfg.widget_id);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  // Field values live in the item config, so edits are local store writes that
  // the canvas can render instantly and the scene's Save button persists --
  // same lifecycle as every other inspector setting.
  const fieldValues = cfg.field_values ?? {};

  useEffect(() => {
    if (!cfg.widget_id || !item.id || item.id.startsWith("temp-")) return;
    getOrCreateWidgetInstance(item.id, cfg.widget_id).then(({ data }) => {
      if (!data) return;
      const patch: Partial<typeof cfg> = {};
      // The instance row still backs StreamWizard.state, so the item needs to
      // know which row is its own.
      if (!cfg.instance_id) patch.instance_id = data.id;
      // Adopt values saved before they moved into the config. Harmless to
      // repeat: it sticks once the scene is saved.
      if (!cfg.field_values) patch.field_values = data.field_values ?? {};
      if (Object.keys(patch).length > 0) {
        // Adoption runs on load, not on a user edit, so it stays out of
        // undo history.
        updateItem(item.id, { config: { ...cfg, ...patch } }, { history: false });
      }
    });
  }, [cfg.widget_id, item.id]);

  function patchFieldValue(key: string, value: unknown) {
    updateItem(item.id, {
      config: { ...cfg, field_values: { ...fieldValues, [key]: value } },
    });
  }

  if (!cfg.widget_id) {
    return (
      <WidgetPicker
        onSelect={(widgetId) =>
          updateItem(item.id, {
            config: { ...cfg, widget_id: widgetId, instance_id: "", field_values: {} },
          })
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate max-w-[120px]">
          {widget?.name ?? "Custom Widget"}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          <Button asChild size="sm" variant="ghost">
            <Link
              href={`/dashboard/widgets/${cfg.widget_id}?from=${encodeURIComponent(currentUrl)}`}
              target="_blank"
            >
              Edit code
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              updateItem(item.id, {
                config: { ...cfg, widget_id: "", instance_id: "", field_values: {} },
              })
            }
          >
            Change
          </Button>
        </div>
      </div>

      {widget && Object.keys(widget.fields).length > 0 && (
        <div className="space-y-3">
          <WidgetFieldList
            fields={widget.fields}
            values={fieldValues}
            onChange={patchFieldValue}
          />
        </div>
      )}

      {widget && Object.keys(widget.fields).length === 0 && (
        <p className="text-xs text-muted-foreground">
          This widget has no configurable fields.
        </p>
      )}
    </div>
  );
}

function WidgetPicker({ onSelect }: { onSelect: (widgetId: string) => void }) {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  useEffect(() => {
    getWidgets().then(({ data }) => {
      setWidgets(data ?? []);
      // Picking from this list should render the widget without another trip.
      primeWidgetCache(data ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading widgets…</p>;
  }

  if (widgets.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          You don&apos;t have any custom widgets yet.
        </p>
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link
            href={`/dashboard/widgets/new?from=${encodeURIComponent(currentUrl)}`}
            target="_blank"
          >
            Create a widget
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Pick a widget to use on the canvas:
      </p>
      {widgets.map((w) => (
        <button
          key={w.id}
          type="button"
          onClick={() => onSelect(w.id)}
          className="w-full text-left px-3 py-2 rounded-md border border-border hover:bg-accent hover:border-primary transition-colors"
        >
          <div className="text-sm font-medium truncate">{w.name}</div>
          {w.description && (
            <div className="text-xs text-muted-foreground truncate mt-0.5">
              {w.description}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
