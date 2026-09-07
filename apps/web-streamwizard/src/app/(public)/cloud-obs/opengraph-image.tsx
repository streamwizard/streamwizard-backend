import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

export const alt = "Cloud OBS for IRL streaming – StreamWizard";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Title lines mirror the page's H1; the subline is the first sentence of its
// meta description. Keep all three in step with page.tsx when the copy moves.
export default function Image() {
  return renderOgImage({
    eyebrow: "Cloud OBS",
    title: ["Your OBS, in the cloud.", "Your phone runs it."],
    subline: "A dedicated OBS for your channel in the cloud, run from the deck on your phone.",
  });
}
