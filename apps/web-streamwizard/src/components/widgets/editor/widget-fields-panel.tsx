"use client";

import type { WidgetFieldSchema } from "@repo/ui/overlay";
import { WidgetFieldList } from "@/components/overlays/widgets/custom/widget-field-input";
import { Button } from "@repo/ui";

/**
 * Lets the author try real field values against the preview. Values are local
 * to the editor session -- a widget row owns defaults, a placed overlay item
 * owns saved values, and this page is neither.
 */
export function WidgetFieldsPanel({
  fields,
  overrides,
  onChange,
  onReset,
}: {
  fields: WidgetFieldSchema;
  overrides: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onReset: () => void;
}) {
  const isEmpty = Object.keys(fields).length === 0;
  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <div className="flex flex-col h-full min-h-0 border-l bg-background w-64 shrink-0">
      <div className="shrink-0 px-3 py-1.5 border-b flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Fields</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs"
          disabled={!hasOverrides}
          onClick={onReset}
        >
          Reset
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {isEmpty ? (
          <p className="text-xs text-muted-foreground">
            No fields yet. Add them in the Fields tab to make this widget configurable.
          </p>
        ) : (
          <WidgetFieldList fields={fields} values={overrides} onChange={onChange} />
        )}
      </div>
    </div>
  );
}
