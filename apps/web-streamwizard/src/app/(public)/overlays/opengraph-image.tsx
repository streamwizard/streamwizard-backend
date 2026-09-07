import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

export const alt = "Stream overlays and alerts – StreamWizard";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Title lines mirror the page's H1; the subline is the first sentence of its
// meta description. Keep all three in step with page.tsx when the copy moves.
export default function Image() {
  return renderOgImage({
    eyebrow: "Overlays",
    title: ["One browser source.", "Everything you put on stream."],
    subline: "Alert box, clips rotator, countdowns and live GPS widgets in one browser source.",
  });
}
