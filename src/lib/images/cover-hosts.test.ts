import { describe, expect, it } from "vitest"
import { capSrcSet, isOptimizableCover } from "./cover-hosts"

describe("isOptimizableCover", () => {
  it("accepts the hosts covers come from", () => {
    expect(
      isOptimizableCover("https://i.scdn.co/image/ab6761610000e5eb955a83ea609d27333f3154f1"),
    ).toBe(true)
    expect(
      isOptimizableCover("https://abc123.supabase.co/storage/v1/object/public/fits/u/1.webp"),
    ).toBe(true)
    expect(isOptimizableCover("https://is1-ssl.mzstatic.com/image/thumb/a/600x600bb.jpg")).toBe(
      true,
    )
    expect(isOptimizableCover("https://i.ebayimg.com/images/g/x/s-l1600.jpg")).toBe(true)
    expect(isOptimizableCover("https://i.ytimg.com/vi/cX3Vs4Eg0Yo/maxresdefault.jpg")).toBe(true)
    expect(isOptimizableCover("https://images.unsplash.com/photo-1?w=1200")).toBe(true)
  })

  it("refuses everything else, so the optimizer can't be used as an open proxy", () => {
    expect(isOptimizableCover("https://example.com/photo.jpg")).toBe(false)
    expect(isOptimizableCover("http://i.scdn.co/image/x")).toBe(false) // not https
    expect(isOptimizableCover("https://i.scdn.co:8443/image/x")).toBe(false)
    expect(isOptimizableCover("https://i.scdn.co.evil.com/image/x")).toBe(false)
    expect(isOptimizableCover("https://supabase.co/storage/v1/object/public/x")).toBe(false)
    expect(isOptimizableCover("https://abc.supabase.co/storage/v1/object/sign/x")).toBe(false) // private
    expect(isOptimizableCover("https://i.ytimg.com/an_webp/x")).toBe(false)
    expect(isOptimizableCover("not a url")).toBe(false)
  })
})

describe("capSrcSet", () => {
  const srcSet =
    "/_next/image?url=a&w=640&q=75 640w, /_next/image?url=a&w=750&q=75 750w, /_next/image?url=a&w=828&q=75 828w, /_next/image?url=a&w=1080&q=75 1080w"

  it("keeps only variants up to the phone cap, so a 3x phone still gets ~750px", () => {
    expect(capSrcSet(srcSet, 750)).toBe(
      "/_next/image?url=a&w=640&q=75 640w, /_next/image?url=a&w=750&q=75 750w",
    )
  })

  it("falls back to the smallest variant rather than none", () => {
    expect(capSrcSet(srcSet, 300)).toBe("/_next/image?url=a&w=640&q=75 640w")
  })
})
