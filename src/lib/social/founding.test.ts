import { describe, expect, it } from "vitest"
import { FOUNDING_SPOTS, inviterFromCookie, nextFoundingNo } from "./founding"

describe("founding 50", () => {
  it("numbers founders in order and stops at 50", () => {
    expect(nextFoundingNo([])).toBe(1)
    expect(nextFoundingNo([1, 2, 3])).toBe(4)
    expect(nextFoundingNo(Array.from({ length: FOUNDING_SPOTS }, (_, i) => i + 1))).toBeNull()
  })

  it("reads the inviter from the cookie header and ignores anything odd", () => {
    expect(inviterFromCookie("a=1; sc_invite=sam.k; b=2")).toBe("sam.k")
    expect(inviterFromCookie("sc_invite=<script>")).toBeNull()
    expect(inviterFromCookie(null)).toBeNull()
  })
})
