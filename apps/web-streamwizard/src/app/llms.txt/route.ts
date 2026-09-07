import { renderLlmsTxt } from "@/lib/llms";

/*
 * A route handler rather than public/llms.txt so the file is built from the
 * same link constants and canonical origin as the sitemap, and so llms.test.ts
 * can check it only links pages in PUBLIC_ROUTES. Nothing here depends on the
 * request, so it renders once at build time like robots.txt and sitemap.xml.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(renderLlmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
