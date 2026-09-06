import { CookieBanner } from "@/components/cookie-banner";
import { LightModeOverlay } from "@/components/global/light-mode-overlay";
import { ThemeProvider } from "@/providers/theme-provider";
import { PHProvider, PostHogPageView } from "@repo/posthog";
import { isIndexableEnvironment, siteUrl } from "@/lib/seo";
import { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { Suspense } from "react";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const SITE_NAME = "StreamWizard";
const SITE_TITLE = "StreamWizard: Cloud OBS, Clips, and Analytics for Twitch";
const SITE_DESCRIPTION =
  "Cloud OBS for IRL streaming, overlays, clip management, and stream analytics for Twitch streamers. Open source and built in public.";

export const metadata: Metadata = {
  // Every relative URL below (and the generated OG image) resolves against this.
  // Without it Next silently emits relative og:image paths, which no scraper follows.
  metadataBase: new URL(siteUrl()),
  title: {
    default: SITE_TITLE,
    template: `%s – ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: {
    name: SITE_NAME,
    url: "https://streamwizard.org",
  },
  // No title/description/url here on purpose. Next copies each page's own
  // resolved title and description into og:* and twitter:* when these blocks
  // leave them unset, so a share of /cloud-obs carries that page's title rather
  // than the site-wide one. A page must never define its own openGraph block:
  // it would replace this one outright and, with it, the file-based
  // opengraph-image.tsx that Next attaches at this segment.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
  // robots.txt already blocks non-production hosts wholesale; this is the
  // second lock, for the case where a preview host is reachable but its
  // robots.txt is not the one we think it is. Pages that must stay out of the
  // index everywhere (/goodbye, /error) override this with their own noindex.
  robots: isIndexableEnvironment()
    ? {
        index: true,
        follow: true,
        // Defaults are a ~160px thumbnail and a truncated snippet. Both of
        // these are opt-in only, and they are what makes the result show the
        // full OG image and quote page copy at length.
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      }
    : { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Per-request nonce set by the proxy (src/proxy.ts). next-themes injects an
  // inline anti-flash script that Next can't nonce for us, so we forward it
  // explicitly or the CSP blocks the script (script-src has no 'unsafe-inline').
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <PHProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange nonce={nonce}>
            <LightModeOverlay />
            <Suspense>
              <PostHogPageView />
            </Suspense>
            <Toaster position="bottom-right" theme="dark" expand visibleToasts={5} />
            <CookieBanner />
            {children}
          </ThemeProvider>
        </PHProvider>
      </body>
    </html>
  );
}
