import { describe, expect, it } from "vitest"
import { TimeoutError, mapWithConcurrency, withTimeout } from "./concurrency"

describe("withTimeout", () => {
  it("resolves when the promise wins", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50)).resolves.toBe("ok")
  })

  it("rejects with TimeoutError when the clock wins", async () => {
    const never = new Promise<never>(() => undefined)
    await expect(withTimeout(never, 5, "db")).rejects.toBeInstanceOf(TimeoutError)
  })

  it("passes through the original rejection", async () => {
    await expect(withTimeout(Promise.reject(new Error("boom")), 50)).rejects.toThrow("boom")
  })
})

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
