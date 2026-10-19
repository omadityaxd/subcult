import { describe, expect, it } from "vitest"
import { hasSessionCookie } from "./session-hint"

describe("hasSessionCookie", () => {
  it("spots a Supabase session cookie, chunked or not", () => {
    expect(hasSessionCookie("sb-abcd-auth-token=base64-xyz")).toBe(true)
    expect(hasSessionCookie("sc_tz=Asia%2FKolkata; sb-abcd-auth-token.0=xyz")).toBe(true)
  })

  it("is false for guests", () => {
    expect(hasSessionCookie("")).toBe(false)
    expect(hasSessionCookie("sc_taste=abc; sc_tz=UTC; sb-abcd-auth-token-code-verifier=x")).toBe(
      false,
    )
  })
})
