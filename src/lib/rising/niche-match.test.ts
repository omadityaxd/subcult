import { describe, expect, it } from "vitest"
import { countsForNiche } from "./niche-match"

const namesTrapArtist = (title: string) => /young thug|gucci mane/i.test(title)

describe("countsForNiche", () => {
  it("regression: generic uses of an ambiguous niche name don't count", () => {
    expect(countsForNiche("Police set a speed trap on the highway", "trap", namesTrapArtist)).toBe(
      false,
    )
    expect(countsForNiche("Is the housing market a trap?", "trap", namesTrapArtist)).toBe(false)
    expect(countsForNiche("Road rage incident in Ohio", "rage", () => false)).toBe(false)
  })

  it("counts headlines that name the niche's verified entities", () => {
    expect(countsForNiche("Young Thug announces a new tape", "trap", namesTrapArtist)).toBe(true)
  })

  it("counts an unambiguous niche name on its own", () => {
    expect(
      countsForNiche("The rise of new-gen underground rap", "new-gen underground rap", () => false),
    ).toBe(true)
    expect(countsForNiche("Shoegaze is back again", "shoegaze", () => false)).toBe(true)
  })
})
