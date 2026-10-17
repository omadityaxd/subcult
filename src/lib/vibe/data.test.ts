import { describe, expect, it } from "vitest"
import { SEED_PROFILES, TAXONOMY } from "@/lib/niches/catalog"
import { VIBE_BLURBS, VIBE_CARDS, deckCards, describeMix, vibeTemplateBlurb } from "./data"
import { scoreVibe, topMix } from "./score"

const SLUGS = new Set(SEED_PROFILES.map((p) => p.slug))

describe("vibe check data", () => {
  it("has about a dozen cards with unique ids", () => {
    expect(VIBE_CARDS.length).toBe(14)
    expect(new Set(VIBE_CARDS.map((c) => c.id)).size).toBe(VIBE_CARDS.length)
  })

  it("only weights niches that exist", () => {
    const unknown = VIBE_CARDS.flatMap((c) => Object.keys(c.weights)).filter((s) => !SLUGS.has(s))
    expect(unknown).toEqual([])
  })

  it("can land on every featured (underground cluster) niche", () => {
    const reachable = new Set(VIBE_CARDS.flatMap((c) => Object.keys(c.weights)))
    expect(TAXONOMY.featured().filter((slug) => !reachable.has(slug))).toEqual([])
  })

  it("is weighted toward the new cluster", () => {
    const featured = new Set(TAXONOMY.featured())
    const all = VIBE_CARDS.flatMap((c) => Object.entries(c.weights))
    const clusterWeight = all.filter(([s]) => featured.has(s)).reduce((n, [, w]) => n + w, 0)
    const total = all.reduce((n, [, w]) => n + w, 0)
    expect(clusterWeight / total).toBeGreaterThan(0.6)
  })

  it("gives every card a real image (verified artist photo or niche photo)", () => {
    // Soundtrack-only niches (glow-up, creator culture) have no face by design:
    // their cards use the niche's generative palette cover instead.
    const faceless = (id: string) => {
      const card = VIBE_CARDS.find((c) => c.id === id)
      return card?.image.kind === "niche" && TAXONOMY.curation(card.image.slug)?.soundtrackOnly
    }
    expect(
      deckCards()
        .filter((card) => !card.imageUrl && !faceless(card.id))
        .map((card) => card.id),
    ).toEqual([])
  })

  it("has a template blurb for every curated niche", () => {
    expect([...SLUGS].filter((slug) => !VIBE_BLURBS.niches[slug])).toEqual([])
    const combos = VIBE_BLURBS.combos.flatMap((c) => c.pair).filter((s) => !SLUGS.has(s))
    expect(combos).toEqual([])
  })

  it("turns a full run of answers into a described mix and a blurb", () => {
    const answers = Object.fromEntries(
      VIBE_CARDS.map((card) => [
        card.id,
        card.id === "pit" || card.id === "leather" ? "like" : "pass",
      ]),
    ) as Record<string, "like" | "pass">
    const mix = topMix(scoreVibe(VIBE_CARDS, answers))
    expect(mix[0].slug).toBe("vamp")
    const described = describeMix(mix)
    expect(described[0]).toMatchObject({ slug: "vamp", name: "vamp" })
    expect(vibeTemplateBlurb(mix)).toMatch(/coffin/)
  })
})
