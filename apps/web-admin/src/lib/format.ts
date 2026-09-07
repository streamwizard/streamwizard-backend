/** Renders a MB quantity as whole GB once it's large enough to be unwieldy in
 * raw MB (e.g. node RAM/VRAM/storage), falling back to a placeholder for
 * still-pending nodes that haven't self-reported a value yet. */
export function formatMb(mb: number | null | undefined, placeholder = "—"): string {
  if (mb == null) return placeholder;
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

/** Compact elapsed time from a millisecond span: "45s", "12m", "3h 20m". */
export function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
