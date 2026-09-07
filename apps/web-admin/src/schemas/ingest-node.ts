import { z } from "zod";

// The node's "name" is used verbatim as its Linux hostname (see rest-api's
// /api/ingest-nodes/claim handler, which passes it through slugifyHostname --
// a no-op for strings that already satisfy this pattern). Same RFC 1123
// label rules as obs-node.ts, for the same reason: no surprise transformation
// between what the admin types and what install.sh sets on the machine.
const hostnamePattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

// Public DNS name encoders connect to (e.g. ingest-01.streamwizard.org). At
// least two dot-separated RFC 1123 labels, so a bare hostname is rejected --
// this must resolve on the public internet, unlike `name` above (the box's
// local Linux hostname). Optional: blank clears it back to the public_ip fallback.
const fqdnPattern = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export const ingestNodeCapacitySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(63, "Must be 63 characters or fewer")
    .regex(
      hostnamePattern,
      "Lowercase letters, numbers, and hyphens only -- can't start or end with a hyphen (this becomes the node's hostname)",
    ),
  max_concurrent_sessions: z.number().int().min(1, "Must be at least 1").nullable(),
  public_hostname: z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim().toLowerCase()) : v),
    z
      .string()
      .max(253, "Must be 253 characters or fewer")
      .regex(fqdnPattern, "Enter a valid domain like ingest-01.streamwizard.org")
      .nullable(),
  ),
});

export type IngestNodeCapacityInput = z.infer<typeof ingestNodeCapacitySchema>;
