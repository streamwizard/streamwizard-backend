"use client";

import { useState } from "react";
import type { WidgetFieldDef, WidgetFieldSchema } from "@repo/ui/overlay";
import { isAssetFieldType, isGroupFieldDef } from "@repo/ui/overlay";
import { AssetPickerDialog } from "@/components/media/asset-picker-dialog";
import type { AssetKind } from "@/actions/assets";
import { GoogleFontSelect } from "@/components/overlays/inspector-fields";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  ColorPicker,
  Input,
  Label,
  Slider,
  Switch,
} from "@repo/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";

/**
 * Renders a whole field schema, turning `type: "group"` entries into
 * collapsible sections like the alert widget's per-event accordion. Grouping is
 * presentation only: `onChange` still reports the leaf field's own key, because
 * a group does not namespace the values it contains.
 */
export function WidgetFieldList({
  fields,
  values,
  onChange,
  idPrefix = "",
}: {
  fields: WidgetFieldSchema;
  /** Resolved values by field key. A missing key falls back to the default. */
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  /** Keeps input ids unique when the same field key appears in two groups. */
  idPrefix?: string;
}) {
  // Consecutive groups share one Accordion so their borders line up; leaves
  // between them still render in the order the author wrote.
  const chunks: { group: boolean; entries: [string, WidgetFieldDef][] }[] = [];
  for (const entry of Object.entries(fields)) {
    const group = isGroupFieldDef(entry[1]);
    const last = chunks[chunks.length - 1];
    if (last && last.group === group) last.entries.push(entry);
    else chunks.push({ group, entries: [entry] });
  }

  return (
    <>
      {chunks.map((chunk, i) =>
        chunk.group ? (
          <Accordion key={`g${i}`} type="multiple" className="-mx-1">
            {chunk.entries.map(([key, def]) => (
              <AccordionItem key={key} value={key} className="border-b">
                <AccordionTrigger className="py-2 px-1 text-xs hover:no-underline">
                  {def.label ?? key}
                </AccordionTrigger>
                <AccordionContent className="space-y-3 px-1 pb-4">
                  <WidgetFieldList
                    fields={def.fields ?? {}}
                    values={values}
                    onChange={onChange}
                    idPrefix={`${idPrefix}${key}-`}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          chunk.entries.map(([key, def]) => (
            <WidgetFieldInput
              key={key}
              fieldKey={key}
              idPrefix={idPrefix}
              def={def}
              value={key in values ? values[key] : def.value}
              onChange={(v) => onChange(key, v)}
            />
          ))
        )
      )}
    </>
  );
}

/**
 * Renders one widget field from its schema definition. Shared by the overlay
 * inspector (editing a placed widget's saved values) and the widget editor's
 * preview panel (trying values out against unsaved code) so the two can never
 * disagree about how a field type is presented.
 */
export function WidgetFieldInput({
  fieldKey,
  def,
  value,
  onChange,
  idPrefix = "",
}: {
  fieldKey: string;
  def: WidgetFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  idPrefix?: string;
}) {
  if (def.type === "hidden") return null;
  // Groups hold no value of their own — WidgetFieldList renders them.
  if (isGroupFieldDef(def)) return null;

  const label = def.label ?? fieldKey;
  const id = `field-${idPrefix}${fieldKey}`;

  if (def.type === "text") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <Input
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm"
        />
      </div>
    );
  }

  if (def.type === "number") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <Input
          type="number"
          value={String(value ?? "")}
          onChange={(e) => onChange(Number(e.target.value))}
          className="text-sm"
        />
      </div>
    );
  }

  if (def.type === "checkbox") {
    return (
      <div className="flex items-center gap-2">
        <Switch
          checked={Boolean(value)}
          onCheckedChange={onChange}
          id={id}
        />
        <Label htmlFor={id} className="text-xs">{label}</Label>
      </div>
    );
  }

  if (def.type === "colorpicker") {
    const hex = typeof value === "string" ? value : "#ffffff";
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <ColorPicker value={hex} onChange={onChange} aria-label={label} />
      </div>
    );
  }

  if (def.type === "slider") {
    const num = typeof value === "number" ? value : Number(def.value ?? 0);
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{label} ({num})</Label>
        <Slider
          value={[num]}
          onValueChange={([v]) => onChange(v)}
          min={def.min ?? 0}
          max={def.max ?? 100}
          step={def.step ?? 1}
          className="py-1"
        />
      </div>
    );
  }

  if (def.type === "dropdown" && def.options) {
    // options can be an array [{value, label}] or a plain object {value: label}
    const options = Array.isArray(def.options)
      ? def.options
      : Object.entries(def.options as Record<string, string>).map(
          ([value, label]) => ({ value, label })
        );
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <Select value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger className="text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (isAssetFieldType(def.type)) {
    return (
      <AssetField
        fieldKey={`${idPrefix}${fieldKey}`}
        label={label}
        kind={def.type as AssetKind}
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
      />
    );
  }

  if (def.type === "googleFont") {
    return (
      <GoogleFontSelect
        id={id}
        value={String(value ?? "")}
        onValueChange={onChange}
      />
    );
  }

  return null;
}

function AssetField({
  fieldKey,
  label,
  kind,
  value,
  onChange,
}: {
  fieldKey: string;
  label: string;
  kind: AssetKind;
  value: string;
  onChange: (v: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileName = value ? decodeURIComponent(value.split("/").pop() ?? value) : null;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        {kind === "image" && value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="h-8 w-8 rounded object-cover bg-muted shrink-0" />
        )}
        <Button
          size="sm"
          variant="outline"
          className="flex-1 min-w-0 justify-start text-xs font-normal"
          onClick={() => setPickerOpen(true)}
        >
          <span className="truncate">{fileName ?? `Choose ${kind}…`}</span>
        </Button>
        {value && (
          <Button size="sm" variant="ghost" className="text-xs shrink-0" onClick={() => onChange("")}>
            Clear
          </Button>
        )}
      </div>
      <AssetPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        kindFilter={[kind]}
        title={`Pick ${kind === "audio" ? "a sound" : `an ${kind}`} for ${label}`}
        onSelect={(asset) => onChange(asset.url)}
        key={`picker-${fieldKey}`}
      />
    </div>
  );
}
