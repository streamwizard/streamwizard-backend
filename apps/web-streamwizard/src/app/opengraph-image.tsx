import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

export const alt = "StreamWizard: Cloud OBS, Clips, and Analytics for Twitch";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// The site-wide card. Pillar pages carry their own opengraph-image.tsx; every
// other route inherits this one.
export default function Image() {
  return renderOgImage({
    eyebrow: "streamwizard.org",
    title: ["Your whole stream,", "one dashboard."],
    subline: "Cloud OBS, clips, and analytics for Twitch. Open source, built in public.",
  });
}
