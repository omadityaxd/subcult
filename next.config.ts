import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
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
