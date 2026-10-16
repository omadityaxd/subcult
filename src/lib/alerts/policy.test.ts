import { describe, expect, it } from "vitest"
import {
  batchPush,
  inQuietHours,
  isPushEndpoint,
  matchesGrail,
  nicheAlertAllowed,
  pushAllowed,
} from "./policy"

const at = (iso: string) => Date.parse(iso)
const DAY = 24 * 3600_000

describe("quiet hours", () => {
  it("defaults to 11pm-9am in the person's own zone", () => {
    // 18:00 UTC = 23:30 in Kolkata (quiet), 14:00 in New York (not).
    const now = at("2026-10-16T18:00:00Z")
    expect(inQuietHours(now, "Asia/Kolkata")).toBe(true)
    expect(inQuietHours(now, "America/New_York")).toBe(false)
    // 03:00 UTC = 08:30 Kolkata (still quiet), 09:30 at 04:00 UTC (awake).
    expect(inQuietHours(at("2026-10-16T03:00:00Z"), "Asia/Kolkata")).toBe(true)
    expect(inQuietHours(at("2026-10-16T04:00:00Z"), "Asia/Kolkata")).toBe(false)
  })

  it("supports custom windows that don't wrap midnight, and off", () => {
    const noonUtc = at("2026-10-16T12:00:00Z")
    expect(inQuietHours(noonUtc, "UTC", 11 * 60, 13 * 60)).toBe(true)
    expect(inQuietHours(noonUtc, "UTC", 13 * 60, 14 * 60)).toBe(false)
    expect(inQuietHours(noonUtc, "UTC", 0, 0)).toBe(false)
  })
})

describe("caps", () => {
  const now = at("2026-10-16T12:00:00Z")
  it("allows one push a day", () => {
    expect(pushAllowed(null, now)).toBe(true)
    expect(pushAllowed(now - 23 * 3600_000, now)).toBe(false)
    expect(pushAllowed(now - DAY, now)).toBe(true)
  })

  it("allows a niche-blowing-up alert once a week", () => {
    expect(nicheAlertAllowed(now - 6 * DAY, now)).toBe(false)
    expect(nicheAlertAllowed(now - 7 * DAY, now)).toBe(true)
  })
})

describe("batchPush", () => {
  it("one alert is itself; several become one push to the center", () => {
    expect(batchPush([])).toBeNull()
    expect(
      batchPush([{ type: "drop", title: "Nettspend dropped KickAss", url: "/n/jerk" }]),
    ).toEqual({
      title: "subcult",
      body: "Nettspend dropped KickAss",
      url: "/n/jerk",
    })
    expect(
      batchPush([
        { type: "grail", title: "Rick Owens geobasket under $400", url: "/x" },
        { type: "drop", title: "fakemink dropped Chiltern Firehouse", url: "/y" },
        { type: "niche", title: "jerk is blowing up", url: "/z" },
      ]),
    ).toEqual({
      title: "subcult · 3 new",
      body: "Rick Owens geobasket under $400 · and 2 more",
      url: "/notifications",
    })
  })
})

describe("matchesGrail", () => {
  const hunt = { brand: "Rick Owens", item: "geobasket", maxPrice: 400, size: "43" }
  const listing = (title: string, price = 350, currency = "USD") => ({ title, price, currency })

  it("needs brand, item, price and the stated size", () => {
    expect(matchesGrail(listing("Rick Owens Geobasket Black Leather Size 43"), hunt)).toBe(true)
    expect(matchesGrail(listing("Rick Owens Geobasket 43", 450), hunt)).toBe(false)
    expect(matchesGrail(listing("Rick Owens Ramones 43"), hunt)).toBe(false)
    expect(matchesGrail(listing("Rick Owens Geobasket 44"), hunt)).toBe(false)
  })

  it("never guesses: no size in the title, no match", () => {
    expect(matchesGrail(listing("Rick Owens Geobasket black"), hunt)).toBe(false)
    expect(matchesGrail(listing("Rick Owens Geobasket black"), { ...hunt, size: null })).toBe(true)
  })

  it("reads sizes like US 10 and letter sizes as whole tokens", () => {
    const jacket = { brand: "Undercover", item: "jacket", maxPrice: 500, size: "M" }
    expect(matchesGrail(listing("Undercover AW03 Scab Jacket Size M"), jacket)).toBe(true)
    expect(matchesGrail(listing("Undercover Jacket Medium Wash Size L"), jacket)).toBe(false)
    const shoe = { brand: "Nike", item: "air max plus", maxPrice: 200, size: "US 10" }
    expect(matchesGrail(listing("Nike Air Max Plus TN Sz 10", 150), shoe)).toBe(true)
  })

  it("ignores listings priced in other currencies", () => {
    expect(matchesGrail(listing("Rick Owens Geobasket 43", 300, "EUR"), hunt)).toBe(false)
  })
})

describe("isPushEndpoint", () => {
  it("accepts the browsers' push services only", () => {
    expect(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true)
    expect(isPushEndpoint("https://web.push.apple.com/QGx")).toBe(true)
    expect(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true)
    expect(isPushEndpoint("https://evil.example.com/fcm.googleapis.com")).toBe(false)
    expect(isPushEndpoint("https://fcm.googleapis.com.evil.com/x")).toBe(false)
    expect(isPushEndpoint("http://fcm.googleapis.com/x")).toBe(false)
    expect(isPushEndpoint("https://169.254.169.254/latest")).toBe(false)
    expect(isPushEndpoint("not a url")).toBe(false)
  })
})
