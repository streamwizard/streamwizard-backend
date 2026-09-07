import { GROUP_FIELD_TYPE, type WidgetFieldSchema } from "@repo/ui/overlay";

/** Normalize fields authored in the JSON editor before saving or previewing.
 *  Dropdown options may be written as a plain object { value: label } instead
 *  of the canonical array [{ value, label }]. Coerce them so downstream code
 *  can always call .map() safely. Groups are walked so fields nested in a
 *  collapsible section get the same treatment. */
export function coerceFields(fields: WidgetFieldSchema): WidgetFieldSchema {
  const out: WidgetFieldSchema = {};
  for (const [key, def] of Object.entries(fields)) {
    if (def.type === GROUP_FIELD_TYPE) {
      out[key] = { ...def, fields: coerceFields(def.fields ?? {}) };
    } else if (
      def.type === "dropdown" &&
      def.options !== undefined &&
      !Array.isArray(def.options)
    ) {
      out[key] = {
        ...def,
        options: Object.entries(def.options as Record<string, string>).map(
          ([value, label]) => ({ value, label })
        ),
      };
    } else {
      out[key] = def;
    }
  }
  return out;
}

