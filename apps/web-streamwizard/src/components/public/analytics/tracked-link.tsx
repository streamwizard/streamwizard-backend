"use client";

import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { captureEvent } from "@repo/posthog";

/*
 * A next/link that reports the click to PostHog as `cta_clicked`.
 *
 * Most of the public pages are server components, so the links in them cannot
 * capture on their own. This is the one client island that does: drop it in
 * where a plain <Link> sat and name the CTA and the section it lives in. The
 * page comes for free (`$pathname` is on every event), the destination is
 * whatever `href` is, and `external` is derived from it.
 */
export interface TrackedLinkProps
  extends Omit<LinkProps, "href">, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick"> {
  href: string;
  /** Stable id for the button itself, e.g. "more_about_clips", "join_discord". */
  cta: string;
  /** Where on the page it sits, e.g. "hero", "final_cta", "footer". */
  section: string;
  children: ReactNode;
}

export function TrackedLink({ href, cta, section, children, ...rest }: TrackedLinkProps) {
  const external = /^https?:\/\//.test(href);
  return (
    <Link
      href={href}
      data-attr={`cta-${section}-${cta}`}
      onClick={() => captureEvent("cta_clicked", { cta, section, href, external })}
      {...rest}
    >
      {children}
    </Link>
  );
}
