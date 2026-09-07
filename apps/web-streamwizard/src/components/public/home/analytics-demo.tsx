import { TrackedLink } from "../analytics/tracked-link";
import { SectionView } from "../analytics/section-view";
import { ArrowRight } from "lucide-react";
import { Button } from "@repo/ui";
import { productLinks } from "@/lib/constant";
import { Reveal } from "./reveal";
import { AnalyticsDemoPanels } from "./analytics-demo-panels";
import { AnalyticsStatsRow } from "./analytics-stats-row";

/*
 * The real dashboard, rendered on the landing page with one demo stream.
 * Labels, icons, and layout mirror /dashboard exactly; only the data is
 * synthetic, and the frame says so.
 */
export function AnalyticsDemo({
  showProductLink = true,
  showHeader = true,
}: { showProductLink?: boolean; showHeader?: boolean } = {}) {
  return (
    <section className="py-20">
      <SectionView section="analytics" className="container mx-auto px-4">
        {showHeader && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300">
              Stream Analytics
            </span>
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Last stream, explained.</h2>
            <p className="mt-4 text-muted-foreground">
              Your latest broadcast, minute by minute. Follows, subs, and clips land on the viewer graph, and the best
              hour gets called out.
            </p>
          </div>
        )}

        <Reveal>
          <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-6">
            <div>
              <AnalyticsStatsRow>
                <AnalyticsDemoPanels />
              </AnalyticsStatsRow>
            </div>
          </div>
        </Reveal>

        <div className="mx-auto mt-8 max-w-2xl space-y-4 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Starting out, the graph is mostly flat, and a rough night looks worse in a chart than it felt live. So the
            numbers are optional: we ask during setup, and it stays one switch in Settings. Turn it off and the
            analytics page goes away entirely, with your clips as the page you land on instead.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We start tracking the moment you go live, so this is your next stream, not your last one.
          </p>
        </div>

        {showProductLink ? (
          <div className="mt-8 flex justify-center">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="gap-2 border-purple-400/30 bg-purple-400/[0.06] px-7 text-purple-200 shadow-md transition-transform duration-200 hover:-translate-y-0.5 hover:bg-purple-400/[0.12] hover:text-purple-100"
            >
              <TrackedLink href={productLinks.analytics} cta="more_about_analytics" section="analytics">
                More about analytics
                <ArrowRight className="size-4" aria-hidden="true" />
              </TrackedLink>
            </Button>
          </div>
        ) : null}
      </SectionView>
    </section>
  );
}
