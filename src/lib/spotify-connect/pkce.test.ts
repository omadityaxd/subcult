import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { CONNECT_SCOPES, authorizeUrl, challengeFor, randomVerifier } from "./pkce"

describe("PKCE", () => {
  it("derives the S256 challenge: base64url(sha256(verifier)), unpadded", async () => {
    const verifier = randomVerifier()
    const expected = createHash("sha256").update(verifier).digest("base64url")
    expect(await challengeFor(verifier)).toBe(expected)
    expect(expected).not.toMatch(/[+/=]/)
  })

  it("makes 64-char verifiers from the unreserved set", () => {
    const verifier = randomVerifier()
    expect(verifier).toHaveLength(64)
    expect(verifier).toMatch(/^[A-Za-z0-9._~-]+$/)
    expect(randomVerifier()).not.toBe(verifier)
  })

  it("asks only for the scopes playback and saving need", () => {
    const url = new URL(
      authorizeUrl({
        clientId: "abc",
        redirectUri: "https://x.app/spotify/callback",
        challenge: "c",
        state: "s",
      }),
    )
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("scope")?.split(" ")).toEqual([...CONNECT_SCOPES])
    expect(url.searchParams.get("redirect_uri")).toBe("https://x.app/spotify/callback")
  })
})
