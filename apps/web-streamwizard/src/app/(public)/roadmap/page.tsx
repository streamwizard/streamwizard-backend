import type { Metadata } from "next";
import { FaGithub } from "react-icons/fa";
import { absoluteUrl } from "@/lib/seo";
import { PageHero } from "@/components/public/layout/page-hero";
import { Reveal } from "@/components/public/home/reveal";
import { SectionView } from "@/components/public/analytics/section-view";
import { TrackedLink } from "@/components/public/analytics/tracked-link";
import { Timeline, TimelineTail } from "@/components/public/roadmap/timeline";
import { TimelineEntry, TimelineItem } from "@/components/public/roadmap/timeline-entry";
import { githubLink } from "@/lib/constant";
import { BETA, PLANNED, SHIPPED } from "./roadmap-data";

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    "What StreamWizard ships today across cloud OBS, overlays, clips, VOD clipping and analytics, and where the live issue tracker lives.",
  alternates: { canonical: absoluteUrl("/roadmap") },
};

/* Lane marker sitting on the spine; bg-background masks the line behind it. */
function LaneChip({ children, tone = "muted" }: { children: string; tone?: "muted" | "purple" }) {
  return (
    <Reveal className="pl-10 md:flex md:justify-center md:pl-0">
      <h2
        className={`inline-flex rounded-full border border-white/[0.08] bg-background px-3 py-1 font-mono text-xs uppercase tracking-widest ${
          tone === "purple" ? "text-purple-300" : "text-muted-foreground"
        }`}
      >
        {children}
      </h2>
    </Reveal>
  );
}

/*
 * The timeline runs future-first: plans fade in at the top, beta work sits in
 * the middle, and everything shipped settles at the bottom.
 */
export default function RoadmapPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <PageHero
        eyebrow="Roadmap"
        title={
          <>
            What&apos;s next, <br /> what&apos;s shipped.
          </>
        }
        lede="The code is public, so the real roadmap is the issue tracker. This is the short version of it."
      />

      <section className="py-16 md:py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <Timeline>
            <TimelineTail />

            <SectionView section="roadmap_planned">
              <LaneChip>Planned</LaneChip>
              <div className="mt-8 space-y-6">
                {PLANNED.map((item, index) => {
                  const side = index % 2 === 0 ? "left" : "right";
                  const delay = index * 0.05;

                  /* A plan with sub-tasks gets the same card as shipped and beta. */
                  return item.items ? (
                    <TimelineEntry
                      key={item.text}
                      entry={{ area: item.text, items: item.items }}
                      status="later"
                      side={side}
                      delay={delay}
                    />
                  ) : (
                    <TimelineItem
                      key={item.text}
                      text={item.text}
                      status="later"
                      side={side}
                      delay={delay}
                    />
                  );
                })}
              </div>
            </SectionView>

            <SectionView section="roadmap_beta" className="mt-14">
              <LaneChip tone="purple">In beta</LaneChip>
              <div className="mt-8">
                <TimelineEntry entry={BETA} status="beta" side="left">
                  <p className="mt-4 text-sm text-muted-foreground">
                    In beta today. The whole group joins shipped when the label comes off.
                  </p>
                </TimelineEntry>
              </div>
            </SectionView>

            <SectionView section="roadmap_shipped" className="mt-14">
              <LaneChip>Shipped</LaneChip>
              <div className="mt-8 space-y-8">
                {SHIPPED.map((entry, index) => (
                  <TimelineEntry
                    key={entry.area}
                    entry={entry}
                    status="shipped"
                    side={index % 2 === 0 ? "right" : "left"}
                    delay={index * 0.05}
                  />
                ))}
              </div>
            </SectionView>

            <SectionView section="roadmap_tracker" className="mt-14">
              <Reveal className="pl-10 md:flex md:justify-center md:pl-0">
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8 md:max-w-xl">
                  <p className="text-sm text-muted-foreground">
                    Dates are not on this page on purpose. Everything is tracked in the open, so the
                    issue tracker is always ahead of this list.
                  </p>
                  <TrackedLink
                    href={`${githubLink}/issues`}
                    cta="github_issues"
                    section="roadmap"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex h-10 items-center gap-2 rounded-md border border-border bg-transparent px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    <FaGithub className="h-4 w-4" aria-hidden="true" />
                    See the issue tracker
                  </TrackedLink>
                </div>
              </Reveal>
            </SectionView>
          </Timeline>
        </div>
      </section>
    </div>
  );
}
