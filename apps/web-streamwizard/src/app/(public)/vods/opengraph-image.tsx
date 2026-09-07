import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage, VOD_AMBER } from "@/lib/og-image";

export const alt = "Clip from your Twitch VODs – StreamWizard";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Title lines mirror the page's H1; the subline is the first sentence of its
// meta description. Keep all three in step with page.tsx when the copy moves.
export default function Image() {
  return renderOgImage({
    eyebrow: "VODs",
    title: ["The clip button", "nobody pressed."],
    subline: "Every follow, sub, raid and ad break marked on your VOD timeline.",
    accent: VOD_AMBER,
  });
}
