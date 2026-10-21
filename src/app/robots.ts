import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/env"

/** Everything public is crawlable; admin, the API and the sign-up steps aren't. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/welcome", "/start", "/join/", "/auth/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
