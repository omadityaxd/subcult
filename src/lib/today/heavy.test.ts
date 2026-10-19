import { describe, expect, it } from "vitest"
import { isHeavy } from "./heavy"

const namesArtist = (title: string) => /lucki|playboi carti|young thug/i.test(title)

describe("isHeavy", () => {
  it("flags violence, deaths and legal trouble", () => {
    expect(isHeavy("Rapper shot dead outside studio", namesArtist)).toBe(true)
    expect(isHeavy("Young Thug sentenced in YSL case", namesArtist)).toBe(true)
    expect(isHeavy("Lucki shows face cut after crew brawl", namesArtist)).toBe(true)
    expect(isHeavy("Playboi Carti in court over tour dispute", namesArtist)).toBe(true)
  })

  it("leaves slang and fashion terms alone", () => {
    expect(isHeavy("Ken Carson killed it at Rolling Loud", namesArtist)).toBe(false)
    expect(isHeavy("Deadstock Rick Owens Geobaskets surface on Grailed", namesArtist)).toBe(false)
    expect(isHeavy("A crash course in archive Margiela", namesArtist)).toBe(false)
  })

  it("only flags softer words when a real person is named", () => {
    expect(isHeavy("Courtside seats and new merch", namesArtist)).toBe(false)
    expect(isHeavy("Fans fight over the last pair", namesArtist)).toBe(false)
    expect(isHeavy("Lucki hospitalized after show", namesArtist)).toBe(true)
  })
})
