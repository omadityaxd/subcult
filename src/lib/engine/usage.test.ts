import { describe, expect, it } from "vitest"
import { startOfUtcDay, usageFromStats } from "./usage"

describe("startOfUtcDay", () => {
  it("returns midnight UTC of the same UTC day", () => {
    expect(startOfUtcDay(new Date("2026-10-10T23:59:59.999Z")).toISOString()).toBe(
      "2026-10-10T00:00:00.000Z",
    )
    expect(startOfUtcDay(new Date("2026-10-11T00:00:00.000Z")).toISOString()).toBe(
      "2026-10-11T00:00:00.000Z",
    )
  })
})

describe("usageFromStats", () => {
  it("flattens generation stats into a ledger row", () => {
    const entry = usageFromStats("niche-generation", "goth", "ok", {
      model: "claude-haiku-5-5",
      usage: { inputTokens: 10, outputTokens: 20 },
      attempts: 2,
      costUsd: 0.001,
      durationMs: 1500,
    })
    expect(entry).toEqual({
      purpose: "niche-generation",
      subject: "goth",
      model: "claude-haiku-5-5",
      status: "ok",
      inputTokens: 10,
      outputTokens: 20,
      attempts: 2,
      costUsd: 0.001,
      durationMs: 1500,
    })
  })
})
