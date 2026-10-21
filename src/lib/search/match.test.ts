import { describe, expect, it } from "vitest"
import { matchScore, resolvesTo, searchEntities } from "./match"

const ARTISTS = [
  { slug: "a-ap-rocky", name: "A$AP Rocky", aliases: ["asap rocky"] },
  { slug: "rick-owens", name: "Rick Owens" },
  { slug: "rico-nasty", name: "Rico Nasty" },
  { slug: "che", name: "Che" },
  { slug: "chief-keef", name: "Chief Keef" },
]

describe("search matching", () => {
  it("ranks exact, then prefix, then word-prefix, then contains", () => {
    expect(matchScore("rick owens", ARTISTS[1]!)).toBe(4)
    expect(matchScore("ric", ARTISTS[1]!)).toBe(3)
    expect(matchScore("owens", ARTISTS[1]!)).toBe(2)
    expect(matchScore("wens", ARTISTS[1]!)).toBe(1)
    expect(matchScore("zz", ARTISTS[1]!)).toBe(0)
  })

  it("finds names written with symbols and their aliases", () => {
    expect(searchEntities("asap", ARTISTS, 5).map((a) => a.slug)).toEqual(["a-ap-rocky"])
    expect(searchEntities("a$ap rocky", ARTISTS, 5).map((a) => a.slug)).toEqual(["a-ap-rocky"])
  })

  it("puts the closest match first", () => {
    expect(searchEntities("che", ARTISTS, 5).map((a) => a.slug)).toEqual(["che"])
    expect(searchEntities("chie", ARTISTS, 5).map((a) => a.slug)).toEqual(["chief-keef"])
    // Same score and length: A to Z.
    expect(searchEntities("ric", ARTISTS, 5).map((a) => a.slug)).toEqual([
      "rick-owens",
      "rico-nasty",
    ])
  })

  it("only treats an exact name as a resolvable (loggable) search", () => {
    expect(resolvesTo("Rick Owens", ARTISTS)?.slug).toBe("rick-owens")
    expect(resolvesTo("rick", ARTISTS)).toBeNull()
    expect(resolvesTo("my ex's address", ARTISTS)).toBeNull()
  })
})
