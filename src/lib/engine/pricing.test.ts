import { describe, expect, it } from "vitest"
import { addUsage, estimateCostUsd, formatUsd } from "./pricing"

describe("estimateCostUsd", () => {
  it("prices haiku 5.5 per million tokens", () => {
    expect(
      estimateCostUsd("claude-haiku-5-5", { inputTokens: 1_000_000, outputTokens: 1_000_000 }),
    ).toBeCloseTo(0.6, 6)
  })

  it("returns null for unknown models", () => {
    expect(estimateCostUsd("mystery-model", { inputTokens: 1, outputTokens: 1 })).toBeNull()
  })
})

describe("addUsage", () => {
  it("sums both counters", () => {
    expect(
      addUsage({ inputTokens: 1, outputTokens: 2 }, { inputTokens: 3, outputTokens: 4 }),
    ).toEqual({
      inputTokens: 4,
      outputTokens: 6,
    })
  })
})

describe("formatUsd", () => {
  it("shows sub-cent amounts with 4 decimals", () => {
    expect(formatUsd(0.00123)).toBe("$0.0012")
    expect(formatUsd(1.5)).toBe("$1.50")
    expect(formatUsd(null)).toBe("$?")
  })
})
