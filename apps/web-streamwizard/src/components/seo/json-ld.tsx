import { headers } from "next/headers";

/**
 * Renders a JSON-LD block carrying the per-request CSP nonce.
 *
 * Browsers treat `application/ld+json` as an inline script under `script-src`,
 * and our policy (src/lib/csp.ts) allows no 'unsafe-inline' and no hashes, so an
 * un-nonced block is refused outright. Development sends the policy as
 * Report-Only, which means a missing nonce looks fine locally and only breaks
 * once deployed. Always render schema through this component rather than
 * hand-rolling a <script> tag.
 */
export async function JsonLd({ schema }: { schema: Record<string, unknown> }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  // Escaping "<" keeps a "</script>" substring from closing the tag early. Our
  // schema is static today, but this stays correct if a value ever comes from
  // the database.
  const json = JSON.stringify(schema).replace(/</g, "\\u003c");

  // suppressHydrationWarning: the CSP spec has browsers move the nonce into an
  // internal slot and blank the content attribute ("nonce hiding", which stops
  // attribute exfiltration via CSS selectors). Hydration then reads "" off the
  // DOM and compares it against the real nonce from the RSC payload, so React
  // reports a mismatch on every request. The script runs and the CSP still
  // holds; only the warning is wrong.
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
