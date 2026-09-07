/** Pure snapping math for the overlay editor canvas. All coordinates are scene-space. */

export interface Guide {
  orientation: "v" | "h";
  /** Scene-space coordinate of the guide line (x for vertical, y for horizontal). */
  position: number;
}

/**
 * A measured gap between the dragged rect and something it lined up with,
 * for the editor to draw and label.
 */
export interface GapBadge {
  /** The axis the gap is measured along. */
  axis: "x" | "y";
  /** Where the gap starts and ends along `axis`. */
  start: number;
  end: number;
  /** Where to draw the marker on the other axis. */
  cross: number;
  /** The gap itself, in scene px. */
  distance: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SnapResult {
  x: number;
  y: number;
  guides: Guide[];
  /** Gaps worth showing for this snap. Empty when nothing lined up. */
  gaps: GapBadge[];
}

/** A coordinate worth snapping to, and the rect that suggested it. */
interface Candidate {
  position: number;
  /** Absent for the scene's own edges and centre. */
  target?: Rect;
}

/** Whether two rects overlap on the axis a gap is *not* measured along. */
function overlapsOnCross(a: Rect, b: Rect, axis: "x" | "y"): boolean {
  return axis === "x"
    ? a.y < b.y + b.h && b.y < a.y + a.h
    : a.x < b.x + b.w && b.x < a.x + a.w;
}

/** Midpoint of the span two rects share on the cross axis, for placing a marker. */
function crossCentre(a: Rect, b: Rect, axis: "x" | "y"): number {
  const [aStart, aEnd, bStart, bEnd] =
    axis === "x" ? [a.y, a.y + a.h, b.y, b.y + b.h] : [a.x, a.x + a.w, b.x, b.x + b.w];
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return start < end ? (start + end) / 2 : (Math.min(aEnd, bEnd) + Math.max(aStart, bStart)) / 2;
}

/** The gap between two rects along one axis, or null when they overlap on it. */
function gapBetween(a: Rect, b: Rect, axis: "x" | "y"): GapBadge | null {
  const [aStart, aSize, bStart, bSize] =
    axis === "x" ? [a.x, a.w, b.x, b.w] : [a.y, a.h, b.y, b.h];

  const first = aStart <= bStart ? { start: aStart, size: aSize } : { start: bStart, size: bSize };
  const second = aStart <= bStart ? { start: bStart, size: bSize } : { start: aStart, size: aSize };

  const start = first.start + first.size;
  const end = second.start;
  if (end < start) return null; // They overlap; there is no gap to label.

  return { axis, start, end, cross: crossCentre(a, b, axis), distance: end - start };
}

/**
 * Positions that leave the moving rect evenly spaced between two targets.
 *
 * This is the "three in a row" case: drop something between two widgets and it
 * settles where both gaps match. Only pairs that actually overlap the moving
 * rect on the other axis count — two widgets in opposite corners of the scene
 * are not a row.
 */
function evenSpacingCandidates(moving: Rect, targets: Rect[], axis: "x" | "y"): number[] {
  const size = axis === "x" ? moving.w : moving.h;
  const start = (r: Rect) => (axis === "x" ? r.x : r.y);
  const end = (r: Rect) => (axis === "x" ? r.x + r.w : r.y + r.h);

  const inRow = targets.filter((t) => overlapsOnCross(moving, t, axis));
  const positions: number[] = [];

  for (const a of inRow) {
    for (const b of inRow) {
      if (a === b) continue;
      const room = start(b) - end(a);
      // Needs to sit between them with something left over on both sides.
      if (room <= size) continue;
      positions.push(end(a) + (room - size) / 2);
    }
  }

  return positions;
}

/**
 * Snap a moving rect to scene edges, scene center, and other rects' edges/centers.
 * Axes resolve independently; the closest candidate within `threshold` wins per axis.
 *
 * Even-spacing is only considered when nothing else matched on that axis, so a
 * deliberate edge alignment always beats a coincidental rhythm and a drag with
 * one target behaves exactly as it did before spacing existed.
 */
export function computeSnap(
  moving: Rect,
  targets: Rect[],
  scene: { width: number; height: number },
  threshold: number,
  /** Axes to snap on. A disabled axis produces no movement, guide or badge. */
  axes: { x: boolean; y: boolean } = { x: true, y: true }
): SnapResult {
  const vCandidates: Candidate[] = [
    { position: 0 },
    { position: scene.width / 2 },
    { position: scene.width },
  ];
  const hCandidates: Candidate[] = [
    { position: 0 },
    { position: scene.height / 2 },
    { position: scene.height },
  ];
  for (const t of targets) {
    vCandidates.push(
      { position: t.x, target: t },
      { position: t.x + t.w / 2, target: t },
      { position: t.x + t.w, target: t }
    );
    hCandidates.push(
      { position: t.y, target: t },
      { position: t.y + t.h / 2, target: t },
      { position: t.y + t.h, target: t }
    );
  }

  const guides: Guide[] = [];

  const snapAxis = (
    pos: number,
    size: number,
    candidates: Candidate[]
  ): { pos: number; guide: number | null; target?: Rect } => {
    const edges = [pos, pos + size / 2, pos + size];
    let best: { delta: number; candidate: Candidate } | null = null;
    for (const candidate of candidates) {
      for (const edge of edges) {
        const delta = candidate.position - edge;
        if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
          best = { delta, candidate };
        }
      }
    }
    return best
      ? { pos: pos + best.delta, guide: best.candidate.position, target: best.candidate.target }
      : { pos, guide: null };
  };

  /** Falls back to even spacing when no edge lined up on this axis. */
  const spacingAxis = (pos: number, axis: "x" | "y"): number | null => {
    let best: { delta: number; position: number } | null = null;
    for (const position of evenSpacingCandidates(moving, targets, axis)) {
      const delta = position - pos;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
        best = { delta, position };
      }
    }
    return best ? best.position : null;
  };

  // A disabled axis is filtered here rather than at the call site, so the guides
  // and badges that come back can never describe a snap that did not happen.
  const idle = { pos: 0, guide: null as number | null };
  const sx: { pos: number; guide: number | null; target?: Rect } = axes.x
    ? snapAxis(moving.x, moving.w, vCandidates)
    : { ...idle, pos: moving.x };
  const sy: { pos: number; guide: number | null; target?: Rect } = axes.y
    ? snapAxis(moving.y, moving.h, hCandidates)
    : { ...idle, pos: moving.y };

  let x = sx.pos;
  let y = sy.pos;
  let evenX = false;
  let evenY = false;

  if (axes.x && sx.guide === null) {
    const spaced = spacingAxis(moving.x, "x");
    if (spaced !== null) {
      x = spaced;
      evenX = true;
    }
  }
  if (axes.y && sy.guide === null) {
    const spaced = spacingAxis(moving.y, "y");
    if (spaced !== null) {
      y = spaced;
      evenY = true;
    }
  }

  if (sx.guide !== null) guides.push({ orientation: "v", position: sx.guide });
  if (sy.guide !== null) guides.push({ orientation: "h", position: sy.guide });

  const settled: Rect = { ...moving, x, y };
  const gaps: GapBadge[] = [];

  // One badge for the thing an edge snapped to, measured across the *other*
  // axis: lining up two left edges says nothing about how far apart they are,
  // and the vertical distance between them is the number you actually want.
  if (sx.target) {
    const gap = gapBetween(settled, sx.target, "y");
    if (gap) gaps.push(gap);
  }
  if (sy.target) {
    const gap = gapBetween(settled, sy.target, "x");
    if (gap) gaps.push(gap);
  }

  // Both sides of an even-spacing snap, which is the whole point of it: two
  // matching numbers is what makes the rhythm visible.
  for (const [even, axis] of [
    [evenX, "x"],
    [evenY, "y"],
  ] as const) {
    if (!even) continue;
    const neighbours = targets
      .filter((t) => overlapsOnCross(settled, t, axis))
      .map((t) => gapBetween(settled, t, axis))
      .filter((gap): gap is GapBadge => gap !== null)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);
    gaps.push(...neighbours);
  }

  return { x, y, guides, gaps };
}
