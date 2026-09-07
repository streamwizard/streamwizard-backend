import { FaDiscord, FaGithub } from "react-icons/fa";
import { Globe, User } from "lucide-react";
import type { IconType } from "react-icons";
import type { LucideIcon } from "lucide-react";
import { TrackedLink } from "@/components/public/analytics/tracked-link";
import { discordInviteLink, githubLink } from "@/lib/constant";
import { routeLastModified } from "@/lib/seo";

/*
 * The trust facts every product page ends on (SW-309): what is verifiably
 * true about who builds this and where it runs. No counts on purpose, same
 * reasoning as the home TrustBand: a small star count or usage number reads
 * worse than none. "Last updated" is the route's PUBLIC_ROUTES date, so the
 * page, the sitemap and the schema agree on when the copy last changed.
 */
const FACTS: { icon: IconType | LucideIcon; label: string; href: string; cta: string }[] = [
  { icon: FaGithub, label: "Open source, MIT licensed", href: githubLink, cta: "github" },
  { icon: Globe, label: "Hosted in the EU", href: "/privacy-policy", cta: "privacy_policy" },
  { icon: User, label: "Built by one streamer", href: "/about", cta: "about" },
  { icon: FaDiscord, label: "Community on Discord", href: discordInviteLink, cta: "discord" },
];

/* "7 Sep 2026": Intl's en-GB short month says "Sept", so the month is by hand. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function FeatureTrustStrip({ path, tone = "purple" }: { path: string; tone?: "purple" | "amber" }) {
  const lastModified = routeLastModified(path);
  const hairline = tone === "amber" ? "via-amber-500/40" : "via-purple-500/40";

  return (
    <section className="relative py-10">
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${hairline} to-transparent`} />
      <div className="container mx-auto px-4">
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {FACTS.map(({ icon: Icon, label, href, cta }) => {
            const external = /^https?:\/\//.test(href);
            return (
              <li key={label}>
                <TrackedLink
                  href={href}
                  cta={cta}
                  section="feature_trust"
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </TrackedLink>
              </li>
            );
          })}
        </ul>
        {lastModified && (
          <p className="mt-4 text-center font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Last updated <time dateTime={lastModified}>{formatDate(lastModified)}</time>
          </p>
        )}
      </div>
    </section>
  );
}
