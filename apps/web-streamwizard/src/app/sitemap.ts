import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: route.lastModified ? new Date(route.lastModified) : new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
