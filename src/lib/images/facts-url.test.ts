import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
const { isFetchableImageUrl } = await import("./facts-server")

describe("isFetchableImageUrl", () => {
  it("fetches public https images only", () => {
    expect(isFetchableImageUrl("https://i.scdn.co/image/abc")).toBe(true)
    expect(isFetchableImageUrl("http://example.com/a.jpg")).toBe(false)
    expect(isFetchableImageUrl("https://localhost/a.jpg")).toBe(false)
    expect(isFetchableImageUrl("https://169.254.169.254/latest")).toBe(false)
    expect(isFetchableImageUrl("https://[::1]/a.jpg")).toBe(false)
    expect(isFetchableImageUrl("https://intranet/a.jpg")).toBe(false)
    expect(isFetchableImageUrl("not a url")).toBe(false)
  })
})
