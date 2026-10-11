import { describe, expect, it } from "vitest"
import { containsTerm, isRelevant, phrasesOnly } from "./relevance"

const RAGE = {
  entities: ["Playboi Carti", "Ken Carson", "Che", "OsamaSon", "Homixide Gang", "Opium"],
  phrases: phrasesOnly(["rage", "rage rap"]),
}
const NEW_GEN = {
  entities: ["Nettspend", "Xaviersobased", "Ken Carson", "OsamaSon", "EsDeeKid"],
  phrases: phrasesOnly(["new-gen underground rap", "new gen underground rap", "new-gen rap"]),
}

describe("containsTerm", () => {
  it("matches whole words and phrases, case- and punctuation-insensitively", () => {
    expect(containsTerm("Ken Carson - Overseas (Official Video)", "ken carson")).toBe(true)
    expect(containsTerm("CHE — MANNEQUIN", "Che")).toBe(true)
    expect(containsTerm("Cherry Glazerr live", "Che")).toBe(false)
    expect(containsTerm("A$AP Rocky interview", "A$AP Rocky")).toBe(true)
  })
})

describe("isRelevant", () => {
  it("keeps videos that name a verified artist", () => {
    expect(
      isRelevant({ title: "Ken Carson LIVE at Rolling Loud", channel: "Rolling Loud" }, RAGE),
    ).toBe(true)
    expect(isRelevant({ title: "MANNEQUIN (Official Video)", channel: "Che" }, RAGE)).toBe(true)
  })

  it("rejects the regional/generic videos that leaked into the feed", () => {
    expect(
      isRelevant(
        {
          title:
            "1st Rap Road Show In Sambalpur Odisha | MEGAFEST OF HATPADA 2024 | LIVE PERFORMANCE",
          channel: "Megafest of Hatpada",
        },
        NEW_GEN,
      ),
    ).toBe(false)
    expect(
      isRelevant(
        { title: "Raw Underground Rap Track Revealed LIVE!", channel: "Karamveer Sikarwar" },
        NEW_GEN,
      ),
    ).toBe(false)
  })

  it("never lets a lone scene word qualify an item", () => {
    expect(
      isRelevant({ title: "Road rage compilation 2026", channel: "Dashcam Daily" }, RAGE),
    ).toBe(false)
    expect(
      isRelevant({ title: "Opium War | China vs Britain", channel: "History Hub" }, RAGE),
    ).toBe(false)
  })

  it("needs corroboration for short or common names", () => {
    expect(isRelevant({ title: "Che Guevara: the full story", channel: "History Hub" }, RAGE)).toBe(
      false,
    )
    expect(
      isRelevant({ title: "Che x OsamaSon studio session", channel: "Fan uploads" }, RAGE),
    ).toBe(true)
  })

  it("accepts multi-word niche phrases", () => {
    expect(
      isRelevant({ title: "What is rage rap? A history", channel: "Genre Explainer" }, RAGE),
    ).toBe(true)
  })
})
