// Maps a connection's self-declared `source` label ("ingest-node:<id>",
// "streamwizard-bot", "obs-auto-switcher") to how the topology renders it.

export type SourceKind = "ingest-node" | "overlay-bot" | "auto-switcher" | "unknown";

export interface SourceLabel {
  kind: SourceKind;
  title: string;
  /** Secondary line (e.g. the ingest node id), when the source carries one. */
  subtitle: string | null;
}

export function describeSource(source: string): SourceLabel {
  if (source.startsWith("ingest-node:")) {
    return { kind: "ingest-node", title: "Ingest Node", subtitle: source.slice("ingest-node:".length) };
  }
  if (source === "streamwizard-bot") {
    return { kind: "overlay-bot", title: "StreamWizard Bot", subtitle: null };
  }
  if (source === "obs-auto-switcher") {
    return { kind: "auto-switcher", title: "Auto Switcher", subtitle: null };
  }
  return { kind: "unknown", title: source === "unknown" ? "Unlabeled client" : source, subtitle: null };
}
