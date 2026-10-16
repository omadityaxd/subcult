import { describe, expect, it } from "vitest"
import { findSeedProfile } from "@/lib/niches/catalog"
import type { NewsArticle } from "@/lib/sources/google-news"
import { newsQueriesFor, onTopic, sceneMatches } from "./news"

const profile = (slug: string) => {
  const found = findSeedProfile(slug)
  if (!found) throw new Error(`no seed profile ${slug}`)
  return found
}

const DAY = 24 * 3600_000
const NOW = Date.parse("2026-10-16T12:00:00Z")
const article = (title: string, ageDays: number): NewsArticle => ({
  title,
  url: `https://example.com/${encodeURIComponent(title)}`,
  outlet: "Hypebeast",
  domain: "hypebeast.com",
  publishedAt: new Date(NOW - ageDays * DAY),
  imageUrl: null,
  summary: null,
})

describe("newsQueriesFor", () => {
  it("searches a scene niche by its verified artists and brands, last week only", () => {
    const [artists, brands] = newsQueriesFor(profile("archive-fashion"))
    expect(artists).toContain('"Playboi Carti"')
    expect(artists).toContain(" OR ")
    expect(brands).toMatch(/^\(.*"Rick Owens".*\) fashion$/)
  })

  it("never searches an aesthetic niche by its (mainstream) soundtrack artists", () => {
    const queries = newsQueriesFor(profile("cottagecore")).join(" ")
    expect(queries).not.toContain("Taylor Swift")
  })
})

describe("onTopic", () => {
  const archive = profile("archive-fashion")

  it("regression: an artist's music news isn't fashion-niche tea", () => {
    expect(onTopic("A$AP Rocky Shares New Song Shroom Clouds", archive)).toBe(false)
    expect(onTopic("Playboi Carti Wears Unreleased Yeezy at ComplexCon", archive)).toBe(true)
  })

  it("regression: one-word brand names need a fashion word", () => {
    expect(onTopic("Spa Fights Closure After Undercover Prostitution Investigation", archive)).toBe(
      false,
    )
    expect(onTopic("UNDERCOVER's Nike Daybreak Drops Today in Three New Colorways", archive)).toBe(
      true,
    )
    expect(onTopic("Rick Owens SS27", archive)).toBe(true)
  })

  it("keeps artist news for music niches", () => {
    expect(onTopic("Listen to a new track from Skepta and fakemink", profile("jerk"))).toBe(true)
  })
})

describe("sceneMatches", () => {
  it("keeps this week's scene-feed stories that name the niche's people", () => {
    const kept = sceneMatches(
      [
        article("fakemink announces debut album", 1),
        article("fakemink headlines last year's festival", 9),
        article("Kenshi Yonezu announces world tour", 1),
      ],
      profile("jerk"),
      NOW,
    )
    expect(kept.map((a) => a.title)).toEqual(["fakemink announces debut album"])
  })
})
