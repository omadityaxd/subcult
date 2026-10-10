import { describe, expect, it } from "vitest"
import { z } from "zod"
import { makeDraft } from "@/lib/engine/test-fixtures"
import { readTrendFiles, trendFileSchema } from "./trend-file"

const sources = [1, 2, 3].map((i) => ({ url: `https://example.com/${i}`, title: `article ${i}` }))
const valid = {
  ...makeDraft({ name: "office siren" }),
  slug: "office-siren",
  schemaVersion: 1,
  trendScore: 72,
  whyNow: "corporate-core fits took over this month",
  sources,
}

describe("trendFileSchema", () => {
  it("accepts a profile with ≥3 distinct sources", () => {
    expect(trendFileSchema.safeParse(valid).success).toBe(true)
  })

  it("rejects too few or duplicate sources and mismatched slugs", () => {
    expect(trendFileSchema.safeParse({ ...valid, sources: sources.slice(0, 2) }).success).toBe(
      false,
    )
    expect(
      trendFileSchema.safeParse({ ...valid, sources: [...sources.slice(0, 2), sources[0]] })
        .success,
    ).toBe(false)
    expect(trendFileSchema.safeParse({ ...valid, slug: "siren" }).success).toBe(false)
  })
})

describe("data/trends", () => {
  // One test over all files so an empty folder (the normal state) still passes.
  it("contains only valid trend files named after their slug", () => {
    for (const { file, result } of readTrendFiles()) {
      if (!result.success) throw new Error(`${file}\n${z.prettifyError(result.error)}`)
      expect(`${result.data.slug}.json`).toBe(file)
    }
  })
})
