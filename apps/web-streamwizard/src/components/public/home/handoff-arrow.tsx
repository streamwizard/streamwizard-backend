"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import { handoffKey, useObsDemo, type DemoSide, type Handoff, type HandoffTarget } from "./obs-demo-store";

/*
 * The hop between the two windows. The OBS window and the deck sit in
 * different rows, so when a visitor goes live or switches a scene in one, the
 * other reacting 600px away is easy to miss. For a moment after a change this
 * draws an arrow from the control they used to the one that reacted, timed so
 * the head lands as the store's fake delay resolves and the target flips.
 *
 * The store owns the clock (`handoff` clears itself) and the rate (one arrow
 * at a time), so the arrow and the target's ring share one timer. Ends are
 * found by `data-handoff` key inside the wrapper the SVG sits in, so a scene
 * row only has to name itself to become a target. The SVG covers the whole
 * demo, so its own rect is the coordinate space: no container ref to keep in
 * sync.
 *
 * Geometry is measured from the DOM and written straight back to it (path
 * `d`, viewBox) rather than round-tripped through state: only the two SVG
 * elements below ever read it. One motion value drives both the line
 * (pathLength) and the head (a point read off the path with getPointAtLength),
 * so they cannot drift apart. CSS offset-path would be tidier but is unreliable
 * on SVG children.
 */

const EDGE_GAP = 10;
const STROKE = "#a78bfa";

/** Cubic between the facing edges of two controls, tangents along the dominant axis. */
function connect(from: DOMRect, to: DOMRect, origin: DOMRect): string {
  const fromCenter = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
  const toCenter = { x: to.left + to.width / 2, y: to.top + to.height / 2 };
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  let sx: number, sy: number, ex: number, ey: number, c1x: number, c1y: number, c2x: number, c2y: number;

  if (Math.abs(dx) >= Math.abs(dy)) {
    const rightward = dx >= 0;
    sx = (rightward ? from.right + EDGE_GAP : from.left - EDGE_GAP) - origin.left;
    sy = fromCenter.y - origin.top;
    ex = (rightward ? to.left - EDGE_GAP : to.right + EDGE_GAP) - origin.left;
    ey = toCenter.y - origin.top;
    const reach = (ex - sx) / 2;
    c1x = sx + reach;
    c1y = sy;
    c2x = ex - reach;
    c2y = ey;
  } else {
    const downward = dy >= 0;
    sx = fromCenter.x - origin.left;
    sy = (downward ? from.bottom + EDGE_GAP : from.top - EDGE_GAP) - origin.top;
    ex = toCenter.x - origin.left;
    ey = (downward ? to.top - EDGE_GAP : to.bottom + EDGE_GAP) - origin.top;
    const reach = (ey - sy) / 2;
    c1x = sx;
    c1y = sy + reach;
    c2x = ex;
    c2y = ey - reach;
  }

  const n = (value: number) => Math.round(value * 10) / 10;
  return `M ${n(sx)},${n(sy)} C ${n(c1x)},${n(c1y)} ${n(c2x)},${n(c2y)} ${n(ex)},${n(ey)}`;
}

function findEnd(root: Element, side: DemoSide, target: HandoffTarget): Element | null {
  return root.querySelector(`[data-handoff="${CSS.escape(handoffKey(side, target))}"]`);
}

/**
 * The path for one handoff in the SVG's coordinate space, or null if an end
 * is not mounted. The precise control can be missing on the receiving side
 * (the deck on another tab, a scene the deck hides): the window itself stands
 * in.
 */
function measure(svg: SVGSVGElement, handoff: Handoff): string | null {
  const root = svg.parentElement;
  if (!root) return null;
  const to: DemoSide = handoff.from === "deck" ? "obs" : "deck";
  const control: HandoffTarget = handoff.kind === "scene" ? { scene: handoff.scene } : "stream";
  const source = findEnd(root, handoff.from, control);
  const target = findEnd(root, to, control) ?? findEnd(root, to, "frame");
  if (!source || !target) return null;
  const origin = svg.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${origin.width} ${origin.height}`);
  return connect(source.getBoundingClientRect(), target.getBoundingClientRect(), origin);
}

const SIDE_NAME: Record<DemoSide, string> = { deck: "the deck", obs: "OBS" };

function announcement(handoff: Handoff): string {
  const from = SIDE_NAME[handoff.from];
  const to = SIDE_NAME[handoff.from === "deck" ? "obs" : "deck"];
  return handoff.kind === "scene"
    ? `Scene switched to ${handoff.scene} from ${from}, ${to} followed.`
    : `Stream toggled from ${from}, ${to} followed.`;
}

export function HandoffArrow() {
  const { handoff } = useObsDemo();
  const svgRef = useRef<SVGSVGElement>(null);
  // Only branches on transition timing, never on the tree, and the arrow only
  // exists after a click, so there is nothing for hydration to disagree on.
  const reduced = useReducedMotion();

  // Announced after the draw, so a screen reader hears the result, not the
  // click. Keyed by handoff so a stale line never reads for a newer toggle.
  const [announced, setAnnounced] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    if (!handoff) return;
    const { id, settleMs } = handoff;
    const text = announcement(handoff);
    const timer = setTimeout(() => setAnnounced({ id, text }), settleMs);
    return () => clearTimeout(timer);
  }, [handoff]);

  return (
    <>
      {/* Below lg the rows stack and the other window is a screen away, so
          the arrow would mostly point off screen; the target's ring still shows. */}
      <svg
        ref={svgRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 hidden h-full w-full overflow-visible lg:block"
      >
        <AnimatePresence>
          {handoff && <Arrow key={handoff.id} handoff={handoff} svgRef={svgRef} instant={Boolean(reduced)} />}
        </AnimatePresence>
      </svg>
      <span aria-live="polite" className="sr-only">
        {handoff && announced?.id === handoff.id ? announced.text : ""}
      </span>
    </>
  );
}

interface ArrowProps {
  handoff: Handoff;
  svgRef: RefObject<SVGSVGElement | null>;
  instant: boolean;
}

function Arrow({ handoff, svgRef, instant }: ArrowProps) {
  const lineRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGPathElement>(null);
  const progress = useMotionValue(0);

  const placeHead = useCallback((p: number) => {
    const line = lineRef.current;
    const head = headRef.current;
    if (!line || !head) return;
    const length = line.getTotalLength();
    const at = length * p;
    const tip = line.getPointAtLength(at);
    const behind = line.getPointAtLength(Math.max(0, at - 2));
    const angle = (Math.atan2(tip.y - behind.y, tip.x - behind.x) * 180) / Math.PI;
    head.setAttribute("transform", `translate(${tip.x} ${tip.y}) rotate(${angle})`);
  }, []);

  useMotionValueEvent(progress, "change", placeHead);

  // Layout effect: the path and head have to be in place before the first
  // paint, or the head flashes at the SVG origin for a frame.
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const line = lineRef.current;
    const head = headRef.current;
    if (!svg || !line || !head) return;

    const layout = () => {
      const d = measure(svg, handoff);
      line.setAttribute("d", d ?? "");
      line.style.visibility = d ? "visible" : "hidden";
      head.style.visibility = d ? "visible" : "hidden";
      if (d) placeHead(progress.get());
    };

    layout();
    window.addEventListener("resize", layout);

    if (instant) {
      progress.set(1);
      return () => window.removeEventListener("resize", layout);
    }
    const controls = animate(progress, 1, { duration: handoff.settleMs / 1000, ease: "easeInOut" });
    return () => {
      controls.stop();
      window.removeEventListener("resize", layout);
    };
  }, [handoff, svgRef, instant, progress, placeHead]);

  return (
    <motion.g
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      style={{ filter: "drop-shadow(0 0 6px rgba(158,122,255,0.55))" }}
    >
      <motion.path
        ref={lineRef}
        fill="none"
        stroke={STROKE}
        strokeWidth={2}
        strokeLinecap="round"
        style={{ pathLength: progress }}
      />
      <path ref={headRef} d="M -8 -5 L 2 0 L -8 5 Z" fill={STROKE} />
    </motion.g>
  );
}
