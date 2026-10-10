import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { resolveSiteUrl } = await import("./env")

describe("resolveSiteUrl", () => {
  it("prefers the explicit site URL", () => {
    expect(
      resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://subcult.app", VERCEL_URL: "x.vercel.app" }),
    ).toBe("https://subcult.app")
  })

  it("uses the production domain in production and the deployment URL in previews", () => {
    const vercel = {
      VERCEL_PROJECT_PRODUCTION_URL: "subcult.vercel.app",
      VERCEL_URL: "subcult-abc.vercel.app",
    }
    expect(resolveSiteUrl({ ...vercel, VERCEL_ENV: "production" })).toBe(
      "https://subcult.vercel.app",
    )
    expect(resolveSiteUrl({ ...vercel, VERCEL_ENV: "preview" })).toBe(
      "https://subcult-abc.vercel.app",
    )
  })

  it("falls back to localhost off Vercel", () => {
    expect(resolveSiteUrl({})).toBe("http://localhost:3000")
  })
})
