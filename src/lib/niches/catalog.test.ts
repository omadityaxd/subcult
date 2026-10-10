import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { nicheProfileSchema } from "@/lib/engine/profile-schema"
import { toNicheSlug } from "@/lib/engine/slug"
import { SEED_PROFILES } from "./catalog"

const DATA_DIR = join(process.cwd(), "data", "niches")
const files = readdirSync(DATA_DIR).filter((file) => file.endsWith(".json"))

describe("seed niche files", () => {
  it("has 55 curated niches (30 originals + the underground cluster)", () => {
    expect(files).toHaveLength(55)
  })

  it.each(files)("%s matches the NicheProfile schema", (file) => {
    const raw: unknown = JSON.parse(readFileSync(join(DATA_DIR, file), "utf8"))
    const result = nicheProfileSchema.safeParse(raw)
    if (!result.success) throw new Error(`${file}\n${z.prettifyError(result.error)}`)
    expect(`${result.data.slug}.json`).toBe(file)
    expect(result.data.slug).toBe(toNicheSlug(result.data.name))
  })

  it("has unique slugs and names", () => {
    const slugs = SEED_PROFILES.map((p) => p.slug)
    const names = SEED_PROFILES.map((p) => p.name)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(new Set(names).size).toBe(names.length)
  })

  it("bundles every file in the catalog index", () => {
    const bundled = new Set(SEED_PROFILES.map((p) => `${p.slug}.json`))
    expect(files.filter((file) => !bundled.has(file))).toEqual([])
  })

  it("only relates niches that exist in the catalog", () => {
    const names = new Set(SEED_PROFILES.map((p) => p.name))
    const dangling = SEED_PROFILES.flatMap((p) =>
      p.relatedNiches.filter((related) => !names.has(related)).map((r) => `${p.slug} → ${r}`),
    )
    expect(dangling).toEqual([])
  })

  it("never lists the same artist or brand twice in one niche", () => {
    for (const profile of SEED_PROFILES) {
      const artists = profile.artists.map((a) => a.name.toLowerCase())
      const brands = profile.brands.map((b) => b.name.toLowerCase())
      expect(new Set(artists).size, profile.slug).toBe(artists.length)
      expect(new Set(brands).size, profile.slug).toBe(brands.length)
    }
  })
})
