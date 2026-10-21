import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/env"
import { NICHE_PRESETS } from "@/lib/niches/catalog"

/** Public pages and every niche. People's profiles stay out: they decide who sees them. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/explore", "/vibe-check", "/about", "/privacy", "/terms", "/content-policy"]
  return [
    ...pages.map((path) => ({
      url: `${siteUrl}${path}`,
      changeFrequency: path === "" ? ("daily" as const) : ("monthly" as const),
      priority: path === "" ? 1 : 0.5,
    })),
    ...NICHE_PRESETS.map((niche) => ({
      url: `${siteUrl}/n/${niche.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ]
}
