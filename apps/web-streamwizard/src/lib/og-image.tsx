import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * One social card layout for every public route: eyebrow, a two-line title
 * with the second line in the pillar's accent, a subline, and a short rule.
 * Each route's opengraph-image.tsx supplies the copy; this file owns the look
 * so the cards read as one family in a feed.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

export const TWITCH_PURPLE = "#9146FF";
/** Tailwind amber-400, the VOD pillar's colour on the page itself. */
export const VOD_AMBER = "#fbbf24";

export type OgImageCopy = {
  /** Small label above the title, e.g. the pillar name or the domain. */
  eyebrow: string;
  /** Two lines; the second takes the accent colour. */
  title: readonly [string, string];
  subline: string;
  accent?: string;
};

export async function renderOgImage({ eyebrow, title, subline, accent = TWITCH_PURPLE }: OgImageCopy) {
  // Static cuts, not the GeistVF.woff the app renders with: Satori's parser
  // cannot read a variable font and dies on it ("names[p.parseUShort()]").
  // These two files exist only for the social cards.
  const fontDir = join(process.cwd(), "src/app/fonts");
  const [regular, semibold] = await Promise.all([
    readFile(join(fontDir, "Geist-Regular.ttf")),
    readFile(join(fontDir, "Geist-SemiBold.ttf")),
  ]);

  // Long lines drop a size rather than wrap into a third line; a wrapped title
  // pushes the subline into the rule.
  const longest = Math.max(title[0].length, title[1].length);
  const titleSize = longest > 26 ? 68 : 82;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0a0a0a",
        padding: 80,
        fontFamily: "Geist",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 14, height: 14, borderRadius: 999, background: accent }} />
        <div style={{ fontSize: 28, color: "#a1a1aa", letterSpacing: -0.5 }}>{eyebrow}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: titleSize, fontWeight: 600, color: "#fafafa", lineHeight: 1.05, letterSpacing: -3 }}>
          {title[0]}
        </div>
        <div style={{ fontSize: titleSize, fontWeight: 600, color: accent, lineHeight: 1.05, letterSpacing: -3 }}>
          {title[1]}
        </div>
        <div style={{ fontSize: 34, color: "#a1a1aa", marginTop: 28, letterSpacing: -0.5, lineHeight: 1.3 }}>
          {subline}
        </div>
      </div>

      <div style={{ display: "flex", height: 6, background: accent, width: 180, borderRadius: 999 }} />
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );
}
