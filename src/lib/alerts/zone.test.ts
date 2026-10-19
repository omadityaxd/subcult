import { describe, expect, it } from "vitest"
import { zoneLabel, zoneToSave } from "./zone"

describe("zoneToSave", () => {
  it("saves the device's zone over the UTC default", () => {
    expect(zoneToSave("UTC", "Asia/Kolkata")).toBe("Asia/Kolkata")
  })

  it("follows the reader when they travel", () => {
    expect(zoneToSave("Asia/Kolkata", "Europe/London")).toBe("Europe/London")
  })

  it("does nothing when they match, or the device's zone is missing or bogus", () => {
    expect(zoneToSave("Asia/Kolkata", "Asia/Kolkata")).toBeNull()
    expect(zoneToSave("UTC", undefined)).toBeNull()
    expect(zoneToSave("UTC", "Mars/Olympus_Mons")).toBeNull()
  })
})

describe("zoneLabel", () => {
  it("names the city", () => {
    expect(zoneLabel("Asia/Kolkata")).toBe("Kolkata time")
    expect(zoneLabel("America/New_York")).toBe("New York time")
    expect(zoneLabel("UTC")).toBe("UTC")
  })
})
