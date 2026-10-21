import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

/** Two-account abuse tests against the real database (`pnpm run test:security`). */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
})
