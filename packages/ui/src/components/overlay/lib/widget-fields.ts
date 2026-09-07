export interface WidgetFieldDef {
  // Free-form, but the editors special-case: "text", "number", "color",
  // "dropdown", "checkbox", the media-library asset types "image", "audio",
  // "video" (value = public CDN URL string), and "group" (see `fields`).
  type: string;
  label?: string;
  value?: unknown;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  /**
   * Only for `type: "group"` — the fields shown inside a collapsible section,
   * the same shape the alert widget's per-event accordion has. Groups are
   * presentation only: their children keep living in the flat value namespace,
   * so `{{key}}` and `fieldData.key` are unaffected by how they are grouped.
   */
  fields?: WidgetFieldSchema;
}

/** Field types whose value is a media-library asset URL. */
export const ASSET_FIELD_TYPES = ["image", "audio", "video"] as const;

export function isAssetFieldType(type: string): boolean {
  return (ASSET_FIELD_TYPES as readonly string[]).includes(type);
}

/** Field type that holds other fields instead of a value of its own. */
export const GROUP_FIELD_TYPE = "group";

export function isGroupFieldDef(def: WidgetFieldDef): boolean {
  return def.type === GROUP_FIELD_TYPE;
}

export type WidgetFieldSchema = Record<string, WidgetFieldDef>;

/**
 * Flattens groups away, leaving only fields that own a value. Nested keys stay
 * as authored — a group is a folder in the inspector, not a namespace — so a
 * duplicate key in two groups collapses to one value, last one winning.
 */
export function flattenFieldSchema(fields: WidgetFieldSchema): WidgetFieldSchema {
  const out: WidgetFieldSchema = {};
  const walk = (schema: WidgetFieldSchema, depth: number) => {
    for (const [key, def] of Object.entries(schema)) {
      if (isGroupFieldDef(def)) {
        // Depth bound keeps a hand-written cyclic-looking schema from stalling
        // the editor; nobody nests inspector sections this deep on purpose.
        if (depth < 5 && def.fields) walk(def.fields, depth + 1);
        continue;
      }
      out[key] = def;
    }
  };
  walk(fields, 0);
  return out;
}

export function mergeFieldValues(
  fields: WidgetFieldSchema,
  overrides: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(flattenFieldSchema(fields))) {
    result[key] = key in overrides ? overrides[key] : def.value;
  }
  return result;
}

export function resolveWidgetTemplate(
  html: string,
  extraCss: string,
  fields: WidgetFieldSchema,
  fieldValues: Record<string, unknown>
): { resolvedHtml: string; resolvedCss: string } {
  const merged = mergeFieldValues(fields, fieldValues);
  const replace = (template: string) =>
    template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      key in merged ? String(merged[key] ?? "") : ""
    );
  return { resolvedHtml: replace(html), resolvedCss: replace(extraCss) };
}
