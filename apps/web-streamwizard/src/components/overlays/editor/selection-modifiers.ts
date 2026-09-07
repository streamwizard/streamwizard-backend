/** True on macOS, where Cmd is the selection modifier and Ctrl+click is a right-click. */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

interface SelectionModifierEvent {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/**
 * Whether a click should add to or remove from the selection rather than
 * replace it.
 *
 * Shift and the platform's own modifier both toggle. Most tools separate them —
 * Shift extends a range, Ctrl toggles one item — but the canvas has no ordered
 * range to extend, so giving them the same meaning is the deliberate choice
 * rather than an oversight.
 *
 * The platform check matters for the mouse in a way it doesn't for the
 * keyboard: on macOS, Ctrl+click *is* a right-click and opens the context menu,
 * so accepting `ctrlKey` there would toggle the selection and open a menu at
 * once. The `metaKey || ctrlKey` idiom used for keyboard shortcuts is wrong here.
 */
export function extendsSelection(
  event: SelectionModifierEvent,
  isMac: boolean = isMacPlatform()
): boolean {
  if (event.shiftKey) return true;
  return isMac ? event.metaKey : event.ctrlKey;
}
