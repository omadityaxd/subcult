import { describe, expect, it } from "vitest"
import { guessItem } from "./grail-hunt"

describe("guessItem", () => {
  it("pulls the piece out of a listing title", () => {
    expect(guessItem("Rick Owens Geobasket Size 43 Black Leather", "Rick Owens")).toBe(
      "geobasket black",
    )
    expect(guessItem("UNDERCOVER AW03 Scab Jacket Mens Size 3", "Undercover")).toBe("scab jacket")
  })
})
