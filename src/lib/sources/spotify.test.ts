import { describe, expect, it, vi } from "vitest"
import { SpotifyRateLimitError, createSpotifyClient, memoryBreaker } from "./spotify"

const token = () =>
  new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 })
const ok = () => new Response(JSON.stringify({ artists: { items: [] } }), { status: 200 })
const limited = (seconds: string) =>
  new Response("", { status: 429, headers: { "retry-after": seconds } })

describe("createSpotifyClient rate limiting", () => {
  it("trips the breaker on 429 and refuses calls until Retry-After passes", async () => {
    let clock = 1_000_000
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("/token") ? token() : limited("120"),
    )
    const breaker = memoryBreaker()
    const client = createSpotifyClient({
      clientId: "id",
      clientSecret: "secret",
      fetchImpl: fetchImpl as typeof fetch,
      breaker,
      now: () => clock,
    })

    await expect(client.search("che", "artist", 10)).rejects.toBeInstanceOf(SpotifyRateLimitError)
    expect(await breaker.blockedUntil()).toBe(clock + 120_000)

    const callsBefore = fetchImpl.mock.calls.length
    await expect(client.search("che", "artist", 10)).rejects.toMatchObject({
      retryAfterSeconds: 120,
    })
    expect(fetchImpl.mock.calls.length).toBe(callsBefore) // no request while blocked

    clock += 121_000
    fetchImpl.mockImplementation(async (url) => (String(url).includes("/token") ? token() : ok()))
    await expect(client.search("che", "artist", 10)).resolves.toEqual({ artists: { items: [] } })
  })

  it("caps the limit at Spotify's dev-mode maximum", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("/token") ? token() : ok(),
    )
    const client = createSpotifyClient({
      clientId: "id",
      clientSecret: "secret",
      fetchImpl: fetchImpl as typeof fetch,
    })
    await client.search("x", "artist", 50)
    expect(String(fetchImpl.mock.calls.at(-1)?.[0])).toContain("limit=10")
  })
})
