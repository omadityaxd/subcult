import type { NextConfig } from "next"
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
