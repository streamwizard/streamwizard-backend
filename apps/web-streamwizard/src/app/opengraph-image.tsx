import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "StreamWizard: Cloud OBS, Clips, and Analytics for Twitch";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TWITCH_PURPLE = "#9146FF";

export default async function Image() {
  // Static cuts, not the GeistVF.woff the app renders with: Satori's parser
  // cannot read a variable font and dies on it ("names[p.parseUShort()]").
  // These two files exist only for this route.
  const fontDir = join(process.cwd(), "src/app/fonts");
  const [regular, semibold] = await Promise.all([
    readFile(join(fontDir, "Geist-Regular.ttf")),
    readFile(join(fontDir, "Geist-SemiBold.ttf")),
  ]);

  return new ImageResponse(
    (
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
          <div style={{ width: 14, height: 14, borderRadius: 999, background: TWITCH_PURPLE }} />
          <div style={{ fontSize: 28, color: "#a1a1aa", letterSpacing: -0.5 }}>streamwizard.org</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 82, fontWeight: 600, color: "#fafafa", lineHeight: 1.05, letterSpacing: -3 }}>
            Your whole stream,
          </div>
          <div style={{ fontSize: 82, fontWeight: 600, color: TWITCH_PURPLE, lineHeight: 1.05, letterSpacing: -3 }}>
            one dashboard.
          </div>
          <div style={{ fontSize: 34, color: "#a1a1aa", marginTop: 28, letterSpacing: -0.5 }}>
            Cloud OBS, clips, and analytics for Twitch. Open source, built in public.
          </div>
        </div>

        <div style={{ display: "flex", height: 6, background: TWITCH_PURPLE, width: 180, borderRadius: 999 }} />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );
}
