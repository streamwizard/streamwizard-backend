import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

export const alt = "Twitch stream analytics – StreamWizard";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Title lines mirror the page's H1; the subline is the first sentence of its
// meta description. Keep all three in step with page.tsx when the copy moves.
export default function Image() {
  return renderOgImage({
    eyebrow: "Analytics",
    title: ["Last stream,", "explained."],
    subline: "Your last broadcast, minute by minute. Follows, subs, raids and clips land on the viewer graph.",
  });
}
