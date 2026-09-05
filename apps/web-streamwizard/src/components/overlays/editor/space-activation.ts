/**
 * Which controls keep the Space key for themselves, and which let the canvas
 * borrow it for panning.
 */

const ACTIVATABLE =
  'button, a, [role="button"], [role="switch"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [role="slider"]';

/** Layers that sit above the canvas; Space stays theirs while they are open. */
const OVERLAY = '[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"]';

/** Keys that move focus, so the next thing focused was reached by keyboard. */
const MOVES_FOCUS = new Set(["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]);

export function movesFocus(key: string) {
  return MOVES_FOCUS.has(key);
}

/** The bits of an element this needs; keeps the rules testable without a DOM. */
export interface SpaceTarget {
  closest?: (selector: string) => SpaceTarget | null;
  blur?: () => void;
}

/** The control Space would activate, when the event happened inside one. */
export function activatableControl(target: SpaceTarget | null | undefined) {
  return target?.closest?.(ACTIVATABLE) ?? null;
}

/**
 * True when Space belongs to the focused control rather than to the canvas.
 *
 * `keyboardFocus` says how focus last moved, and it has to be tracked by hand:
 * :focus-visible cannot answer this from inside a Space keydown, because the
 * keypress is itself keyboard interaction and the browser has already flipped
 * a mouse-clicked button to :focus-visible by the time we ask.
 */
export function keepsSpace(target: SpaceTarget | null | undefined, keyboardFocus: boolean) {
  // A menu or dialog is open over the canvas: panning behind it makes no sense.
  if (target?.closest?.(OVERLAY)) return true;
  return keyboardFocus && !!activatableControl(target);
}
