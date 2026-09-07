import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

export const alt = "Pricing – StreamWizard";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Title lines mirror the page's H1; the subline is the first sentence of its
// meta description. Keep all three in step with page.tsx when the copy moves.
export default function Image() {
  return renderOgImage({
    eyebrow: "Pricing",
    title: ["Most of it is free.", "The rest runs on a server."],
    subline: "Clips, overlays, VOD clipping and analytics are free.",
  });
}
