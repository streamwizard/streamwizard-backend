/**
 * Works out which events a widget actually cares about by reading its source,
 * so the demo picker can lead with those instead of a flat list of 70-odd
 * listeners. Best-effort by design: the result only ever changes the ordering,
 * never what's available.
 */

export interface WidgetListenerScan {
  /** Known listener strings found in the source, in first-appearance order. */
  listeners: string[];
  /** The widget subscribes to the event API at all. */
  usesEventApi: boolean;
  /**
   * False when the scan learned nothing useful and the picker should show a
   * flat list rather than a confidently-wrong "used by this widget" section.
   */
  confident: boolean;
  /**
   * Set when the widget ships its own demo mode -- the pattern Demo mode
   * replaces. Names the identifiers found so the note can quote them.
   */
  legacyDemo: { hits: string[] } | null;
}

/**
 * Dotted lowercase identifiers inside a string literal. Deliberately broad:
 * anything that isn't in the known catalogue is dropped below, so a stray
 * "lodash.debounce" can't become a false positive. Matching narrowly here
 * instead would just trade false positives for false negatives.
 */
const LISTENER_LITERAL = /['"`]([a-z_]+(?:\.[a-z_0-9]+)+)['"`]/gi;

/** The identifiers a hand-rolled demo mode tends to use. */
const LEGACY_DEMO_PATTERN = /\b(demoMode|startDemo|mockData|fakeData|simulateEvents)\b/g;

export function scanWidgetListeners(
  js: string,
  known: readonly string[]
): WidgetListenerScan {
  const knownSet = new Set(known);
  const listeners: string[] = [];
  const seen = new Set<string>();

  for (const match of js.matchAll(LISTENER_LITERAL)) {
    const candidate = match[1];
    if (!candidate || seen.has(candidate) || !knownSet.has(candidate)) continue;
    seen.add(candidate);
    listeners.push(candidate);
  }

  const usesEventApi = js.includes("onEventReceived");

  const legacyHits = [...new Set(Array.from(js.matchAll(LEGACY_DEMO_PATTERN), (m) => m[1]!))];

  return {
    listeners,
    usesEventApi,
    // Finding nothing while the widget clearly handles events means the
    // listener strings are computed, looked up in a map, or minified away.
    confident: listeners.length > 0,
    legacyDemo: legacyHits.length > 0 ? { hits: legacyHits } : null,
  };
}
