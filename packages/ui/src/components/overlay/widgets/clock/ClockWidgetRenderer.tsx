"use client";

import { useEffect, useState } from "react";
import { useGoogleFont } from "../../hooks/use-google-font";
import { formatClockWidgetDisplay } from "../../lib/format-clock-widget";
import {
  normalizeClockWidgetConfig,
  resolvedTextWidgetFontFamily,
} from "../../types";
import type { WidgetRenderProps } from "../text/TextWidgetRenderer";

function justifyForAlign(align: "left" | "center" | "right"): string {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

export function ClockWidgetRenderer({ item }: WidgetRenderProps) {
  const cfg = normalizeClockWidgetConfig(item.config);
  const fontFamily = resolvedTextWidgetFontFamily(cfg);
  useGoogleFont(fontFamily);

  const [display, setDisplay] = useState(() =>
    formatClockWidgetDisplay(cfg, new Date())
  );

  useEffect(() => {
    const c = normalizeClockWidgetConfig(item.config);
    function tick() {
      setDisplay(formatClockWidgetDisplay(c, new Date()));
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [item.config]);

  const stacked = cfg.layout === "stacked" && cfg.showDate && cfg.showTime;

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
      {stacked ? (
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "pre-line",
            lineHeight: 1.2,
            maxWidth: "100%",
          }}
        >
          {display}
        </span>
      ) : (
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
      )}
    </div>
  );
}
