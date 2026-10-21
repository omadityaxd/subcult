import { describe, expect, it } from "vitest"
import { contentSecurityPolicy, securityHeaders } from "./csp"

const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((d) => d.startsWith(`${name} `) || d === name)
    ?.split(" ")
    .slice(1) ?? null

describe("content security policy", () => {
  const csp = contentSecurityPolicy()

  it("frames only the Spotify and YouTube embeds, and is never framed itself", () => {
    expect(directive(csp, "frame-src")).toEqual([
      "https://open.spotify.com",
      "https://sdk.scdn.co",
      "https://www.youtube-nocookie.com",
      "https://www.youtube.com",
    ])
    expect(directive(csp, "frame-ancestors")).toEqual(["'none'"])
    expect(directive(csp, "object-src")).toEqual(["'none'"])
  })

  it("plays previews from iTunes and nowhere unexpected", () => {
    expect(directive(csp, "media-src")).toContain("https://*.itunes.apple.com")
    expect(directive(csp, "media-src")).not.toContain("https:")
  })

  it("only allows eval in development", () => {
    expect(directive(csp, "script-src")).not.toContain("'unsafe-eval'")
    expect(directive(contentSecurityPolicy({ dev: true }), "script-src")).toContain("'unsafe-eval'")
    expect(csp).toContain("upgrade-insecure-requests")
  })

  it("ships the companion hardening headers", () => {
    const names = securityHeaders().map((h) => h.key)
    expect(names).toEqual([
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "X-Frame-Options",
      "Permissions-Policy",
    ])
  })
})
