"use client";

import { toast } from "sonner";
import type { NodeHealthStatus } from "./node-health";

/** Presentation helpers shared by the OBS-node and ingest-node admin sections. */

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export function copyToClipboard(value: string, what: string) {
  navigator.clipboard.writeText(value);
  toast.success(`${what} copied`);
}

/** Claim status of a node row: linked / pending / anything else. */
export function nodeStatusVariant(status: string): BadgeVariant {
  if (status === "linked") return "default";
  if (status === "pending") return "secondary";
  return "outline";
}

export function nodeHealthVariant(health: NodeHealthStatus): BadgeVariant {
  if (health === "online") return "default";
  if (health === "unlinked") return "outline";
  return "destructive"; // offline, unreachable
}

export function nodeHealthLabel(health: NodeHealthStatus): string {
  if (health === "online") return "Online";
  if (health === "offline") return "Offline";
  if (health === "unreachable") return "Unreachable";
  return "Not linked";
}
