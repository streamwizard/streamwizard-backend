import Image from "next/image";
import { Button } from "@repo/ui";
import { TrackedLink } from "@/components/public/analytics/tracked-link";
import type { Metadata } from "next";

// Offboarding page: reachable, but nothing here belongs in a search result.
// noindex rather than a robots.txt Disallow, so crawlers can actually read it.
export const metadata: Metadata = {
  title: "Account deleted",
  robots: { index: false, follow: false },
};

export default function GoodbyePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">
            Your account is gone.
          </h1>
          <p className="text-muted-foreground">
            Data deleted. Clips orphaned. Your Twitch chat will have to roast
            you without our help now.
          </p>
        </div>

        <div className="flex justify-center">
          <Image
            src="/goodbye.gif"
            alt="Goodbye"
            width={480}
            height={270}
            unoptimized
            priority
            className="rounded-xl"
            style={{ width: "100%", height: "auto" }}
          />
        </div>

        <div className="pt-4 border-t border-border space-y-3">
          <p className="text-sm text-muted-foreground">Changed your mind?</p>
          <TrackedLink href="/login" cta="start_over" section="goodbye">
            <Button variant="outline" size="sm">
              Start over
            </Button>
          </TrackedLink>
        </div>
      </div>
    </div>
  );
}
