import { FaGithub } from "react-icons/fa";
import { SectionView } from "@/components/public/analytics/section-view";
import { TrackedLink } from "@/components/public/analytics/tracked-link";
import { RevealGroup } from "@/components/public/home/reveal";
import { githubLink } from "@/lib/constant";

// The four categories from the actual ticket modal, reused as a visual.
const CATEGORIES = ["🐛 Bug", "✨ Feature", "💬 Support", "📨 Other"];

const ctaClass =
  "inline-flex h-10 items-center gap-2 rounded-md border border-border bg-transparent px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent";

export function IdeasSection() {
  return (
    <section className="py-20">
      <SectionView section="contact_ideas" className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Bring us your worst ideas too.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Bug reports are welcome. Feature requests are more welcome, and they can be as crazy as
            you can think of. We are trying to find out what streamers actually want, so we can
            build exactly that. The roadmap is public, so you can watch your idea move.
          </p>

          <RevealGroup
            className="mt-8 flex flex-wrap justify-center gap-3"
            items={CATEGORIES.map((category) => ({
              node: (
                <span className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 font-mono text-xs text-muted-foreground">
                  {category}
                </span>
              ),
            }))}
          />

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <TrackedLink href="/roadmap" cta="roadmap" section="contact_ideas" className={ctaClass}>
              See the roadmap
            </TrackedLink>
            <TrackedLink
              href={`${githubLink}/issues`}
              cta="github_issues"
              section="contact_ideas"
              target="_blank"
              rel="noopener noreferrer"
              className={ctaClass}
            >
              <FaGithub className="h-4 w-4" aria-hidden="true" />
              Browse open issues
            </TrackedLink>
          </div>
        </div>
      </SectionView>
    </section>
  );
}
