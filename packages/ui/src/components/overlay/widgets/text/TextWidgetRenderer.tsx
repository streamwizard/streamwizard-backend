"use client";

import { useGoogleFont } from "../../hooks/use-google-font";
import { asTextWidgetConfig, resolvedTextWidgetFontFamily } from "../../types";
import type { OverlayItem } from "../../types";

export type WidgetRenderProps = {
  item: OverlayItem;
};

function justifyForAlign(align: "left" | "center" | "right"): string {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

export function TextWidgetRenderer({ item }: WidgetRenderProps) {
  const cfg = asTextWidgetConfig(item.config);
  const fontFamily = resolvedTextWidgetFontFamily(cfg);
  useGoogleFont(fontFamily);

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
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
          lineHeight: 1.2,
          maxWidth: "100%",
        }}
      >
        {cfg.text}
      </span>
    </div>
  );
}
