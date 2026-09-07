"use client";

import { useEffect, useState } from "react";
import { useGoogleFont } from "../../hooks/use-google-font";
import { formatCountdownMs } from "../../lib/format-countdown";
import {
  normalizeTimerWidgetConfig,
  resolvedTextWidgetFontFamily,
  type TimerWidgetItemConfig,
} from "../../types";
import type { WidgetRenderProps } from "../text/TextWidgetRenderer";

function justifyForAlign(align: "left" | "center" | "right"): string {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

function deadlineMsFromConfig(cfg: TimerWidgetItemConfig): number | null {
  if (cfg.countdownMode === "absolute") {
    const t = Date.parse(cfg.targetAtIso);
    return Number.isNaN(t) ? null : t;
  }
  return Date.now() + cfg.durationSeconds * 1000;
}

function computeDisplay(cfg: TimerWidgetItemConfig, deadlineMs: number): string {
  const left = deadlineMs - Date.now();
  if (left <= 0) return cfg.finishedText;
  return formatCountdownMs(left);
}

export function TimerWidgetRenderer({ item }: WidgetRenderProps) {
  const cfg = normalizeTimerWidgetConfig(item.config);
  const fontFamily = resolvedTextWidgetFontFamily(cfg);
  useGoogleFont(fontFamily);

  const initialDeadline = deadlineMsFromConfig(cfg);
  const [display, setDisplay] = useState(() =>
    initialDeadline === null ? cfg.finishedText : computeDisplay(cfg, initialDeadline)
  );

  useEffect(() => {
    const c = normalizeTimerWidgetConfig(item.config);
    const deadline = deadlineMsFromConfig(c);

    function tick() {
      if (deadline === null) {
        setDisplay(c.finishedText);
        return;
      }
      setDisplay(computeDisplay(c, deadline));
    }

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [item.config]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: justifyForAlign(cfg.align),
        boxSizing: "border-box",
        padding: "4px 8px",
        color: cfg.color,
        fontSize: cfg.fontSize,
        fontWeight: cfg.fontWeight,
        fontFamily: `"${fontFamily}", sans-serif`,
        textAlign: cfg.align,
      }}
    >
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          lineHeight: 1.375,
          maxWidth: "100%",
        }}
      >
        {display}
      </span>
    </div>
  );
}
