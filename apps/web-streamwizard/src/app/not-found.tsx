import type { Metadata } from "next";
import { Button } from "@repo/ui";
import { TrackedLink } from "@/components/public/analytics/tracked-link";
import { Footer } from "@/components/public/layout/footer";
import Header from "@/components/public/layout/header";
import { hasSessionCookie } from "@/lib/auth";
import { docsLink } from "@/lib/constant";

// Owning the metadata here matters: without this file Next's built-in
// not-found boundary and the root layout both emitted a <title> and a robots
// tag, so every 404 shipped two of each. Next always injects its own
// `<meta name="robots" content="noindex">` on a 404, so `robots: null` drops
// the inherited index/follow tag rather than adding a second noindex.
export const metadata: Metadata = {
  title: "Page not found",
  robots: null,
};

// Root-level so it catches every unmatched URL, which also means it renders
// outside (public)/layout.tsx. The header and footer are composed by hand so
// a dead link still lands on something that looks like the site.
export default async function NotFound() {
  const isAuthenticated = await hasSessionCookie();

  return (
    <>
      <Header isAuthenticated={isAuthenticated} />
      <main>
        <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
          <div className="w-full max-w-lg space-y-8 text-center">
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">404</p>
              <h1 className="text-3xl font-bold tracking-tight">This page doesn&apos;t exist.</h1>
              <p className="text-muted-foreground">
                Wrong link, old bookmark, or a typo. Either way there&apos;s nothing here.
              </p>
            </div>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <TrackedLink href="/" cta="home" section="not_found">
                <Button className="w-full sm:w-auto">Back to the front page</Button>
              </TrackedLink>
              <TrackedLink href={docsLink} cta="docs" section="not_found" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full sm:w-auto">
                  Read the docs
                </Button>
              </TrackedLink>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
