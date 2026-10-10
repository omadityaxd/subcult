import { describe, expect, it } from "vitest"
import { mapWithConcurrency } from "./concurrency"

const tick = () => new Promise((resolve) => setTimeout(resolve, 1))

describe("mapWithConcurrency", () => {
  it("never exceeds the limit and preserves order", async () => {
    let active = 0
    let peak = 0
    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      active++
      peak = Math.max(peak, active)
      await tick()
      active--
      return n * 10
    })

    expect(peak).toBe(3)
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual([
      10, 20, 30, 40, 50, 60, 70,
    ])
  })

  it("isolates failures", async () => {
    const results = await mapWithConcurrency(["a", "b"], 2, async (item) => {
      if (item === "a") throw new Error("boom")
      return item
    })
    expect(results[0].status).toBe("rejected")
    expect(results[1]).toEqual({ status: "fulfilled", value: "b" })
  })

  it("handles empty input and rejects bad limits", async () => {
    await expect(mapWithConcurrency([], 3, async () => 1)).resolves.toEqual([])
    await expect(mapWithConcurrency([1], 0, async () => 1)).rejects.toThrow(/concurrency/)
  })
})
