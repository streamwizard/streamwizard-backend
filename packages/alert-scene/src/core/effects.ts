import type { ClipEffects } from "./types";

/** A tint that would not change a pixel is treated as no tint at all. */
export function hasTint(effects: ClipEffects): boolean {
  return effects.tint !== null && effects.tint.amount > 0;
}

/**
 * The SVG filter id for a clip's tint. Scoped per stage so two stages on one
 * page (the editor preview behind a live canvas alert) never resolve each
 * other's defs.
 */
export function tintFilterId(stageId: string, clipId: string): string {
  return `sw-tint-${stageId}-${clipId}`;
}

/**
 * CSS `filter` functions for a clip, in paint order: tint first so the shadow
 * keeps the colour it was given and the blur softens both. Static per clip.
 */
export function effectsFilterList(effects: ClipEffects, tintId: string): string[] {
  const out: string[] = [];
  if (hasTint(effects)) out.push(`url(#${tintId})`);
  if (effects.shadow) {
    const s = effects.shadow;
    out.push(`drop-shadow(${s.x}px ${s.y}px ${s.blur}px ${s.color})`);
  }
  if (effects.blur > 0) out.push(`blur(${effects.blur}px)`);
  return out;
}

/**
 * The tint filter's arithmetic: `result = (1 − amount) × source + amount ×
 * (colour ∩ source alpha)`. Alpha is untouched, so a transparent PNG, text
 * and a rounded shape all tint only where they paint.
 */
export function tintArithmetic(amount: number): { k2: number; k3: number } {
  const a = Math.min(1, Math.max(0, amount));
  return { k2: 1 - a, k3: a };
}
