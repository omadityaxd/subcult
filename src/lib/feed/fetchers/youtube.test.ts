import { describe, expect, it, vi } from "vitest"
import { makeDraft } from "@/lib/engine/test-fixtures"
import { memoryQuota } from "../quota"
import { artistQuery, youtubeFetcher } from "./youtube"

const video = (id: string, title: string, channel: string) => ({
  id: { videoId: id },
  snippet: { title, channelTitle: channel, publishedAt: "2026-10-01T00:00:00Z" },
})

const RESPONSE = {
  items: [
    video("a", "Ken Carson - Overseas (Live)", "Rolling Loud"),
    video("b", "1st Rap Road Show In Sambalpur Odisha | LIVE PERFORMANCE", "Megafest of Hatpada"),
    video("c", "MANNEQUIN (Official Video)", "Che"),
  ],
}

const profile = { ...makeDraft(), slug: "rage", schemaVersion: 1 as const }

describe("artistQuery", () => {
  it("ORs the first three exact artist names", () => {
    expect(artistQuery(["Ken Carson", "Che", "OsamaSon", "Yeat"])).toBe(
      '"Ken Carson" | "Che" | "OsamaSon"',
    )
    expect(artistQuery([])).toBeNull()
  })
})

describe("youtubeFetcher relevance", () => {
  it("searches US/English by verified artists and drops unrelated videos", async () => {
    const fetchImpl = vi.fn<(url: string | URL | Request) => Promise<Response>>(
      async () => new Response(JSON.stringify(RESPONSE)),
    )
    const fetcher = youtubeFetcher("key", memoryQuota(10), fetchImpl as typeof fetch, () => ({
      artists: ["Ken Carson", "Che"],
      terms: { entities: ["Ken Carson", "Che"], phrases: ["rage rap"] },
    }))
    const items = await fetcher.fetch(profile)
    expect(items.map((item) => item.id)).toEqual(["youtube:video:a", "youtube:video:c"])
    const url = new URL(String(fetchImpl.mock.calls[0][0]))
    expect(url.searchParams.get("q")).toBe('"Ken Carson" | "Che"')
    expect(url.searchParams.get("regionCode")).toBe("US")
    expect(url.searchParams.get("relevanceLanguage")).toBe("en")
    expect(fetcher.cacheVersion).toBe("r3")
  })

  it("without terms, keeps the old query and results", async () => {
    const fetchImpl = vi.fn<(url: string | URL | Request) => Promise<Response>>(
      async () => new Response(JSON.stringify(RESPONSE)),
    )
    const items = await youtubeFetcher("key", memoryQuota(10), fetchImpl as typeof fetch).fetch(
      profile,
    )
    expect(items).toHaveLength(3)
  })
})
