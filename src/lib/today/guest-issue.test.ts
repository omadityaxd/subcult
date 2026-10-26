import { describe, expect, it } from "vitest"
import { guestIssueKey, isGuestRequest } from "./guest-issue"

const guest = { entities: [], brands: [], lastVisit: null, timeZone: "Asia/Kolkata" }

describe("isGuestRequest", () => {
  it("is a first-time visitor with nothing personal", () => {
    expect(isGuestRequest(guest)).toBe(true)
    expect(isGuestRequest({ ...guest, viewerId: null })).toBe(true)
  })

  it("never shares a personal issue: signed in, taste, brands, a past visit or a niche page", () => {
    expect(isGuestRequest({ ...guest, viewerId: "u1" })).toBe(false)
    expect(isGuestRequest({ ...guest, entities: [{ ref: "niche:rage", score: 1 }] })).toBe(false)
    expect(isGuestRequest({ ...guest, brands: ["rick-owens"] })).toBe(false)
    expect(isGuestRequest({ ...guest, lastVisit: 1 })).toBe(false)
    expect(isGuestRequest({ ...guest, scopeNiche: "rage" })).toBe(false)
  })
})

describe("guestIssueKey", () => {
  // 2026-10-26 is a Monday. 03:00 UTC = 08:30 in Kolkata (morning), 23:00 Sunday in New York.
  const now = Date.parse("2026-10-26T03:00:00Z")

  it("splits by zone, local day and edition mode", () => {
    expect(guestIssueKey("Asia/Kolkata", now)).toBe(
      "subcult:today:guest:v1:Asia/Kolkata:2026-10-26:morning",
    )
    expect(guestIssueKey("America/New_York", now)).toBe(
      "subcult:today:guest:v1:America/New_York:2026-10-25:night",
    )
  })

  it("is the same key for everyone in a zone within the same edition", () => {
    expect(guestIssueKey("Asia/Kolkata", now)).toBe(guestIssueKey("Asia/Kolkata", now + 60_000))
  })

  it("treats an invalid zone as UTC", () => {
    expect(guestIssueKey("Not/AZone", now)).toBe(guestIssueKey("UTC", now))
  })
})
