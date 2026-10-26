import type { NextConfig } from "next"
import { COVER_IMAGE_HOSTS } from "./src/lib/images/cover-hosts"
import { securityHeaders } from "./src/lib/security/csp"

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // CSP and friends on every response (lib/security/csp.ts: what's allowed and why).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({ dev: process.env.NODE_ENV !== "production" }),
      },
    ]
  },
  // Share images read their fonts from disk at request time: ship them with
  // every route that renders one (vibe-check share images, Wrapped exports).
  outputFileTracingIncludes: {
    "/vibe-check/r/**": ["./src/assets/fonts/**/*"],
    "/api/wrapped/**": ["./src/assets/fonts/**/*"],
  },
  partialPrefetching: true,
  // Only the issue cover uses the optimizer (lib/images/cover-hosts.ts); everything
  // else asks the source CDNs for sized variants and never reaches /_next/image.
  images: {
    // WebP only: AVIF is ~3.6KB smaller on a 750px cover but took ~670ms to encode on a
    // cache miss (WebP ~140ms), and personal covers are often a first request.
    formats: ["image/webp"],
    remotePatterns: COVER_IMAGE_HOSTS.map((pattern) => ({ ...pattern })),
    // Cover URLs don't change in place: keep resized variants for a month.
    minimumCacheTTL: 31 * 24 * 3600,
    maximumResponseBody: 15_000_000,
  },
  experimental: {
    // `next upgrade` keeps this app on security releases.
    agentUpgrade: "security",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
