import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Share images read their fonts from disk at request time: ship them with
  // every route under /vibe-check/r (the share page and its OG image).
  outputFileTracingIncludes: {
    "/vibe-check/r/**": ["./src/assets/fonts/**/*"],
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
