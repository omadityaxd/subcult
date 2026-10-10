import { describe, expect, it } from "vitest"
import { apiError, apiOk, clientIp } from "./request"

describe("clientIp", () => {
  it("takes the first x-forwarded-for hop", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7",
    )
  })

  it("falls back to x-real-ip, then unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2")
    expect(clientIp(new Headers())).toBe("unknown")
  })
})

describe("api envelope", () => {
  it("wraps data and errors", async () => {
    const ok = apiOk({ slug: "goth" }, 201)
    expect(ok.status).toBe(201)
    expect(await ok.json()).toEqual({ success: true, data: { slug: "goth" } })

    const err = apiError("nope", 429)
    expect(err.status).toBe(429)
    expect(await err.json()).toEqual({ success: false, error: "nope" })
  })
})
