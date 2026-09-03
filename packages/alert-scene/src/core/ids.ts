/** Ids are only unique within a scene, so a short random suffix is plenty. */
export function createId(prefix = ""): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const raw = c?.randomUUID ? c.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return prefix ? `${prefix}_${raw}` : raw;
}
