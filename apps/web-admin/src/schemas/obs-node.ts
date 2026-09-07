import { z } from "zod";

// The node's "name" is used verbatim as its Linux hostname (see
// rest-api's /api/nodes/claim handler, which passes it through
// slugifyHostname -- a no-op for strings that already satisfy this
// pattern). Enforcing the same RFC 1123 label rules at input time means
// what the admin types is exactly what install.sh sets on the machine,
// with no surprise transformation in between.
const hostnamePattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export const obsNodeCapacitySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(63, "Must be 63 characters or fewer")
    .regex(
      hostnamePattern,
      "Lowercase letters, numbers, and hyphens only -- can't start or end with a hyphen (this becomes the node's hostname)",
    ),
  api_url: z.string().min(1, "API URL is required").url("Must be a valid URL"),
  max_instances: z.number().int().min(1, "Must be at least 1"),
});

export type ObsNodeCapacityInput = z.infer<typeof obsNodeCapacitySchema>;
