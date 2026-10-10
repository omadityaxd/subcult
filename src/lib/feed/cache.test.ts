import { describe, expect, it, vi } from "vitest"
import { type CacheStore, cached, memoryStore } from "./cache"

const policy = { freshSeconds: 60, staleSeconds: 600 }

describe("cached", () => {
  it("misses, then hits while fresh", async () => {
    let clock = 0
    const store = memoryStore(() => clock)
    const load = vi.fn(async () => ["a"])

    expect((await cached(store, "k", policy, load, { now: () => clock })).state).toBe("miss")
    clock = 30_000
    expect((await cached(store, "k", policy, load, { now: () => clock })).state).toBe("hit")
    expect(load).toHaveBeenCalledTimes(1)
  })

  it("refetches once fresh time has passed", async () => {
    let clock = 0
    const store = memoryStore(() => clock)
    const load = vi.fn(async () => clock)
    await cached(store, "k", policy, load, { now: () => clock })
    clock = 61_000
    const result = await cached(store, "k", policy, load, { now: () => clock })
    expect(result).toMatchObject({ state: "miss", value: 61_000 })
  })

  it("serves stale data when the source fails", async () => {
    let clock = 0
    const store = memoryStore(() => clock)
    await cached(store, "k", policy, async () => "good", { now: () => clock })
    clock = 120_000
    const result = await cached(
      store,
      "k",
      policy,
      async () => {
        throw new Error("quota exceeded")
      },
      { now: () => clock },
    )
    expect(result).toMatchObject({ state: "stale", value: "good" })
  })

  it("throws when the source fails and nothing is cached", async () => {
    await expect(
      cached(memoryStore(), "k", policy, async () => {
        throw new Error("down")
      }),
    ).rejects.toThrow("down")
  })

  it("survives a broken store (treated as a miss)", async () => {
    const broken: CacheStore = {
      get: async () => {
        throw new Error("redis down")
      },
      set: async () => {
        throw new Error("redis down")
      },
    }
    const onStoreError = vi.fn()
    const result = await cached(broken, "k", policy, async () => 42, { onStoreError })
    expect(result).toMatchObject({ state: "miss", value: 42 })
    expect(onStoreError).toHaveBeenCalledTimes(2)
  })
})
