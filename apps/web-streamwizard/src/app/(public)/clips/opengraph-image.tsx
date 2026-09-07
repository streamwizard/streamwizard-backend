import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

export const alt = "Twitch clip manager with folders – StreamWizard";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Title lines mirror the page's H1; the subline is the first sentence of its
// meta description. Keep all three in step with page.tsx when the copy moves.
export default function Image() {
  return renderOgImage({
    eyebrow: "Clips",
    title: ["One endless pile of clips.", "Not any more."],
    subline:
      "Every clip from your Twitch channel, synced the moment your stream ends and filed into folders you create.",
  });
}
