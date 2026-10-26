import { describe, expect, it } from "vitest"
import { isOnboarding } from "./onboarding"

describe("isOnboarding", () => {
  it("is the handle, vibe check and niche steps", () => {
    for (const path of ["/welcome", "/vibe-check", "/start", "/start/"]) {
      expect(isOnboarding(path), path).toBe(true)
    }
  })

  it("is not the issue, a shared result, or paths that merely start the same", () => {
    for (const path of ["/", "/me", "/vibe-check/r/rage", "/starter", null]) {
      expect(isOnboarding(path), String(path)).toBe(false)
    }
  })
})
