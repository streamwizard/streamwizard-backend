import { expect, test } from "bun:test";
import { LLMS_SECTIONS, isInternalHref, renderLlmsTxt } from "./llms";
import { PUBLIC_ROUTES, siteUrl } from "./seo";

const allEntries = LLMS_SECTIONS.flatMap((section) => section.entries);

test("every internal link is a page search engines may see", () => {
  const indexable = new Set(PUBLIC_ROUTES.map((route) => route.path));
  for (const entry of allEntries.filter((e) => isInternalHref(e.href))) {
    expect(indexable.has(entry.href)).toBe(true);
  }
});

test("every link resolves to a host StreamWizard controls", () => {
  const allowed = new Set([
    new URL(siteUrl()).host,
    "docs.streamwizard.org",
    "github.com",
    "discord.gg",
    "twitch.tv",
  ]);
  const body = renderLlmsTxt();
  const urls = [...body.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => new URL(m[1]));
  expect(urls.length).toBe(allEntries.length);
  for (const url of urls) {
    expect(allowed.has(url.host)).toBe(true);
    if (url.host === "github.com") expect(url.pathname.startsWith("/streamwizard")).toBe(true);
  }
});

test("follows the llms.txt shape and the tone guide", () => {
  const body = renderLlmsTxt();
  expect(body.startsWith("# StreamWizard\n\n> ")).toBe(true);
  for (const section of LLMS_SECTIONS) expect(body).toContain(`\n## ${section.heading}\n`);
  // The tone guide bans em dashes; an answer engine quotes this text verbatim.
  expect(body).not.toContain("—");
  // No relative links left unresolved.
  expect(body).not.toMatch(/\]\(\//);
});
