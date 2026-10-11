import { describe, expect, it } from "vitest"
import { brandArchive, dateFromTitle, formatPrice } from "./archive"
import type { Listing } from "./ebay"

const listing = (title: string, price: number): Listing => ({
  id: title,
  title,
  price,
  currency: "USD",
  imageUrl: null,
  condition: null,
  seller: null,
  url: "https://www.ebay.com/itm/1",
  createdAt: null,
})

describe("dateFromTitle", () => {
  it("reads seasons, years and decades the way sellers write them", () => {
    expect(dateFromTitle("Rick Owens FW06 Dustulator leather jacket")).toEqual({
      season: "FW06",
      era: "2000s",
    })
    expect(dateFromTitle("Raf Simons AW 2002 Virginia Creeper bomber")).toEqual({
      season: "AW02",
      era: "2000s",
    })
    expect(dateFromTitle("Helmut Lang 1998 bondage strap jeans")).toEqual({
      season: null,
      era: "1990s",
    })
    expect(dateFromTitle("vintage 90s Vivienne Westwood orb tee")).toEqual({
      season: null,
      era: "1990s",
    })
    expect(dateFromTitle("Y2K Von Dutch trucker")).toEqual({ season: null, era: "2000s" })
    expect(dateFromTitle("Rick Owens Geobasket size 43")).toEqual({ season: null, era: null })
  })

  it("never dates a piece in the future", () => {
    expect(dateFromTitle("Undercover SS99 Ambivalence tee").era).toBe("1990s")
    expect(dateFromTitle("Rick Owens FW 2099 jacket").season).toBeNull()
  })
})

describe("brandArchive", () => {
  it("groups by era (oldest first, undated last), prices a range and flags grails", () => {
    const archive = brandArchive({ name: "Raf Simons", slug: "raf-simons" }, [
      listing("Raf Simons AW02 Virginia Creeper parka", 4200),
      listing("Raf Simons 1998 knit", 650),
      listing("Raf Simons x Fred Perry polo", 60),
      listing("Raf Simons runway sample shirt", 180),
      listing("Raf Simons Ozweego", 140),
    ])
    expect(archive.priceRange).toEqual({ min: 60, max: 4200, currency: "USD" })
    expect(archive.eras.map((group) => group.era)).toEqual(["1990s", "2000s", null])
    const grails = archive.eras
      .flatMap((g) => g.listings)
      .filter((l) => l.grail)
      .map((l) => l.price)
    expect(grails.sort((a, b) => a - b)).toEqual([180, 650, 4200])
  })

  it("has no range when nothing is listed", () => {
    expect(brandArchive({ name: "X", slug: "x" }, []).priceRange).toBeNull()
  })
})

describe("formatPrice", () => {
  it("drops cents on big numbers", () => {
    expect(formatPrice(4200, "USD")).toBe("$4,200")
    expect(formatPrice(59.5, "USD")).toBe("$59.50")
  })
})
