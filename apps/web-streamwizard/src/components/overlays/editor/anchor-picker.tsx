"use client";

import {
  ANCHOR_X_VALUES,
  ANCHOR_Y_VALUES,
  type Anchor,
  type AnchorX,
  type AnchorY,
} from "@repo/ui/overlay";

const X_LABELS: Record<AnchorX, string> = {
  left: "left",
  center: "center",
  right: "right",
};

const Y_LABELS: Record<AnchorY, string> = {
  top: "top",
  center: "middle",
  bottom: "bottom",
};

function cellLabel(x: AnchorX, y: AnchorY): string {
  if (x === "center" && y === "center") return "Pin to the center";
  if (y === "center") return `Pin to the ${X_LABELS[x]} edge, centered vertically`;
  if (x === "center") return `Pin to the ${Y_LABELS[y]} edge, centered horizontally`;
  return `Pin to the ${Y_LABELS[y]} ${X_LABELS[x]} corner`;
}

/**
 * A 3x3 grid of pins: which scene edge (or the centre) a widget is measured
 * from. Picking a cell does not move the widget; it changes what X and Y mean.
 */
export function AnchorPicker({
  value,
  onChange,
  disabled,
}: {
  value: Anchor;
  onChange: (anchor: Anchor) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Pinned to"
      className="grid grid-cols-3 gap-1 rounded-md border border-input bg-background p-1"
    >
      {ANCHOR_Y_VALUES.map((y) =>
        ANCHOR_X_VALUES.map((x) => {
          const selected = value.x === x && value.y === y;
          return (
            <button
              key={`${x}-${y}`}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={cellLabel(x, y)}
              title={cellLabel(x, y)}
              disabled={disabled}
              onClick={() => onChange({ x, y })}
              className={`flex h-4 w-4 items-center justify-center rounded-sm transition-colors
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                disabled:cursor-not-allowed disabled:opacity-50
                ${selected ? "bg-primary" : "hover:bg-accent"}`}
            >
              <span
                className={`block h-1.5 w-1.5 rounded-full ${
                  selected ? "bg-primary-foreground" : "bg-muted-foreground/60"
                }`}
              />
            </button>
          );
        })
      )}
    </div>
  );
}
