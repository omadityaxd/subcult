import { describe, expect, it } from "vitest"
import { isAuthorizedBasic, isAuthorizedBearer, safeEqual } from "./admin-auth"

const basic = (user: string, password: string) => `Basic ${btoa(`${user}:${password}`)}`

describe("safeEqual", () => {
  it("compares strings of any length", () => {
    expect(safeEqual("secret", "secret")).toBe(true)
    expect(safeEqual("secret", "secreT")).toBe(false)
    expect(safeEqual("secret", "secret-longer")).toBe(false)
    expect(safeEqual("", "")).toBe(true)
  })
})

describe("isAuthorizedBasic", () => {
  it("accepts the right password with any username", () => {
    expect(isAuthorizedBasic(basic("admin", "hunter2"), "hunter2")).toBe(true)
    expect(isAuthorizedBasic(basic("", "hunter2"), "hunter2")).toBe(true)
  })

  it("rejects wrong, malformed or missing credentials", () => {
    expect(isAuthorizedBasic(basic("admin", "nope"), "hunter2")).toBe(false)
    expect(isAuthorizedBasic("Basic !!!not-base64", "hunter2")).toBe(false)
    expect(isAuthorizedBasic(`Basic ${btoa("no-colon")}`, "hunter2")).toBe(false)
    expect(isAuthorizedBasic(null, "hunter2")).toBe(false)
  })

  it("is disabled when no secret is configured", () => {
    expect(isAuthorizedBasic(basic("admin", ""), undefined)).toBe(false)
  })
})

describe("isAuthorizedBearer", () => {
  it("matches the exact token only", () => {
    expect(isAuthorizedBearer("Bearer cron-123", "cron-123")).toBe(true)
    expect(isAuthorizedBearer("Bearer cron-124", "cron-123")).toBe(false)
    expect(isAuthorizedBearer("Basic cron-123", "cron-123")).toBe(false)
    expect(isAuthorizedBearer("Bearer cron-123", undefined)).toBe(false)
  })
})
