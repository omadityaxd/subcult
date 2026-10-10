import { describe, expect, it } from "vitest"
import { createMemoryLimiter } from "./memory-limiter"

describe("createMemoryLimiter", () => {
  it("allows up to max hits per window, per identifier", async () => {
    let clock = 0
    const limiter = createMemoryLimiter(2, 1000, () => clock)

    expect((await limiter.limit("ip:a")).success).toBe(true)
    expect((await limiter.limit("ip:a")).success).toBe(true)
    const third = await limiter.limit("ip:a")
    expect(third).toMatchObject({ success: false, remaining: 0, resetAt: 1000 })
    expect((await limiter.limit("ip:b")).success).toBe(true)

    clock = 1000
    expect((await limiter.limit("ip:a")).success).toBe(true)
  })
})
