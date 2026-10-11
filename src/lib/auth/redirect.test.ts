import { describe, expect, it } from "vitest"
import { safeNext } from "./redirect"

describe("safeNext", () => {
  it("keeps same-site paths and drops anything that could leave the site", () => {
    expect(safeNext("/fits/new")).toBe("/fits/new")
    expect(safeNext("https://evil.com")).toBe("/me")
    expect(safeNext("//evil.com")).toBe("/me")
    expect(safeNext(String.raw`/\evil.com`)).toBe("/me")
    expect(safeNext(null)).toBe("/me")
    // URL parsers strip tab/CR/LF, turning these into //evil.com (security review).
    expect(safeNext("/\t/evil.com")).toBe("/me")
    expect(safeNext("/\n/evil.com")).toBe("/me")
    expect(safeNext(decodeURIComponent("/%0d/evil.com"))).toBe("/me")
    expect(safeNext("/n/vamp?tab=fits#top")).toBe("/n/vamp?tab=fits#top")
  })
})
