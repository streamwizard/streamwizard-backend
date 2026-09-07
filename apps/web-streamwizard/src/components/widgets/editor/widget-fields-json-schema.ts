/**
 * JSON Schema for the widget editor's Fields tab, powering Monaco validation
 * and completion. `WidgetFieldDef.type` is deliberately free-form in TypeScript
 * so custom field types keep working, so the known types are offered as
 * suggestions (`examples`) rather than an enum -- an unknown type must not be
 * reported as an error.
 *
 * The list mirrors the branches in `WidgetFieldInput`, which is the real
 * contract for what the inspector can render.
 */
export const WIDGET_FIELDS_SCHEMA_URI = "https://streamwizard.org/schemas/widget-fields.json";

const KNOWN_TYPES = [
  "group",
  "text",
  "number",
  "checkbox",
  "colorpicker",
  "slider",
  "dropdown",
  "googleFont",
  "image",
  "audio",
  "video",
  "hidden",
];

// Self-referencing so a "group" field can hold fields, including further
// groups. Monaco resolves $ref within the same schema document.
const FIELD_DEF = {
  type: "object",
  required: ["type"],
  properties: {
    type: {
      type: "string",
      description: "How the field is presented in the inspector.",
      examples: KNOWN_TYPES,
    },
    label: {
      type: "string",
      description: "Shown above the input. Defaults to the field key.",
    },
    value: {
      description: "Default value. Its type should match the field type.",
    },
    fields: {
      type: "object",
      description:
        "Fields shown inside this collapsible section. Only for type 'group'. Grouping is presentation only -- these keys stay top-level in {{placeholders}} and fieldData.",
      additionalProperties: { $ref: "#/definitions/field" },
    },
    options: {
      description: "Choices for a dropdown field.",
      oneOf: [
        {
          type: "array",
          items: {
            type: "object",
            required: ["value", "label"],
            properties: {
              value: { type: "string" },
              label: { type: "string" },
            },
            additionalProperties: false,
          },
        },
        {
          type: "object",
          description: "Shorthand: { value: label }. Normalised on save.",
          additionalProperties: { type: "string" },
        },
      ],
    },
    min: { type: "number", description: "Slider minimum. Default 0." },
    max: { type: "number", description: "Slider maximum. Default 100." },
    step: { type: "number", description: "Slider step. Default 1." },
  },
  additionalProperties: false,
} as const;

export const WIDGET_FIELDS_JSON_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "Widget fields",
  type: "object",
  description:
    "Configurable fields for this widget. Each key becomes a {{placeholder}} in HTML/CSS and a fieldData entry in JS.",
  definitions: { field: FIELD_DEF },
  additionalProperties: { $ref: "#/definitions/field" },
} as const;
