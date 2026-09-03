/** `m:ss.mmm` for the transport readout. */
export function formatTimecode(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

/** Short ruler label: `0s`, `250ms`, `1.5s`, `12s`. */
export function formatRulerLabel(ms: number): string {
  if (ms === 0) return "0s";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  return `${Number.isInteger(s) ? s : s.toFixed(2).replace(/\.?0+$/, "")}s`;
}

/** `1.5s` style for durations in the UI. */
export function formatSeconds(ms: number, digits = 1): string {
  return `${(ms / 1000).toFixed(digits).replace(/\.?0+$/, "")}s`;
}
