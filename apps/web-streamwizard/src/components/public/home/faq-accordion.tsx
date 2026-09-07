"use client";

import { ChevronDownIcon } from "lucide-react";
import { captureEvent } from "@repo/posthog";
import { TrackedLink } from "../analytics/tracked-link";

/*
 * The FAQ list as native <details>/<summary> rather than the Radix accordion.
 * Radix only mounts an answer once its question is open, so the server HTML
 * carried empty panels and the answer text existed solely in the hydration
 * payload. Text-extraction crawlers (the ones behind AI answer engines) never
 * saw it. A <details> element keeps the answer in the markup whether open or
 * not, and the browser hides closed content from view and from assistive tech
 * on its own.
 *
 * `name` groups the items so opening one closes the rest (Chrome 120+, Safari
 * 17.2+, Firefox 130+); older browsers simply allow more than one open, which
 * is fine. The open/close animation lives in globals.css and is progressive.
 *
 * Still a client island so opening a question can report which one:
 * `faq_opened` with the question text. Closing reports nothing, and the
 * sibling that closes because of the exclusive group fires toggle with
 * open=false, so it stays quiet too.
 *
 * An item may end on a link (the cost answers point at /pricing). It is a
 * separate field rather than markup in `answer` so the same item can feed
 * faqPageSchema, which needs the answer as plain text and adds the anchor
 * itself. The link reports as `cta_clicked` in section "faq"; the page comes
 * from `$pathname`.
 */
export interface FaqItem {
  question: string;
  answer: string;
  link?: { label: string; href: string; cta: string };
}

export function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  return (
    <div className="w-full">
      {items.map(({ question, answer, link }) => (
        <details
          key={question}
          name="faq"
          className="group border-b last:border-b-0"
          onToggle={(event) => {
            if (event.currentTarget.open) captureEvent("faq_opened", { question });
          }}
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-md py-4 text-left text-base font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            {question}
            <ChevronDownIcon
              className="pointer-events-none size-4 shrink-0 translate-y-1 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="pt-0 pb-4 text-sm leading-relaxed text-muted-foreground">
            {answer}
            {link && (
              <>
                {" "}
                <TrackedLink
                  href={link.href}
                  cta={link.cta}
                  section="faq"
                  className="text-purple-300 transition-colors hover:text-purple-200"
                >
                  {link.label}
                </TrackedLink>
              </>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
