import { describe, expect, it } from "vitest"
import { addCost, addUsage, estimateCostUsd, formatUsd } from "./pricing"

describe("estimateCostUsd", () => {
  it("prices a typical haiku 5.5 request at $0.10 / $0.50 per MTok", () => {
    // 2K in / 3K out: 2000 * 0.10 / 1M + 3000 * 0.50 / 1M
    expect(
      estimateCostUsd("claude-haiku-5-5", { inputTokens: 2_000, outputTokens: 3_000 }),
    ).toBeCloseTo(0.0017, 8)
  })

  it("switches the whole request to the long-context rate above 100K prompt tokens", () => {
    expect(
      estimateCostUsd("claude-haiku-5-5", { inputTokens: 100_000, outputTokens: 0 }),
    ).toBeCloseTo(0.01, 8)
    expect(
      estimateCostUsd("claude-haiku-5-5", { inputTokens: 200_000, outputTokens: 1_000 }),
    ).toBeCloseTo(0.1 + 0.0025, 8)
  })

  it("returns null for unknown models", () => {
    expect(estimateCostUsd("mystery-model", { inputTokens: 1, outputTokens: 1 })).toBeNull()
  })
})

describe("addUsage / addCost", () => {
  it("sums both counters", () => {
    expect(
      addUsage({ inputTokens: 1, outputTokens: 2 }, { inputTokens: 3, outputTokens: 4 }),
    ).toEqual({ inputTokens: 4, outputTokens: 6 })
  })

  it("propagates unknown costs", () => {
    expect(addCost(0.1, 0.2)).toBeCloseTo(0.3, 10)
    expect(addCost(0.1, null)).toBeNull()
  })
})

describe("formatUsd", () => {
  it("shows sub-cent amounts with 4 decimals", () => {
    expect(formatUsd(0.00123)).toBe("$0.0012")
    expect(formatUsd(1.5)).toBe("$1.50")
    expect(formatUsd(null)).toBe("$?")
  })
})
