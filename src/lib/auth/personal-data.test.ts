import { describe, expect, it } from "vitest"
import { PERSONAL_COOKIES, personalStorageKeys } from "./personal-data"

describe("sign-out clears personal state", () => {
  it("removes everything the account owns and keeps device settings", () => {
    const stored = [
      "subcult-taste-v1",
      "subcult-saves-v1",
      "subcult-vibe-v1",
      "subcult-votes-v1",
      "subcult-issues-v1",
      "subcult-recent-searches-v1",
      "subcult-spotify-session",
      "subcult-onboarded-v1",
      "subcult-theme",
      "subcult-audio-muted",
      "subcult-install-dismissed",
      "someone-elses-key",
    ]
    expect(personalStorageKeys(stored)).toEqual([
      "subcult-taste-v1",
      "subcult-saves-v1",
      "subcult-vibe-v1",
      "subcult-votes-v1",
      "subcult-issues-v1",
      "subcult-recent-searches-v1",
      "subcult-spotify-session",
      "subcult-onboarded-v1",
    ])
  })

  it("expires the cookies that personalise the server-rendered issue", () => {
    expect([...PERSONAL_COOKIES].sort()).toEqual(["sc_issue", "sc_prev", "sc_taste"])
  })
})
