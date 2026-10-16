import { describe, expect, it } from "vitest"
import type { FeedItem } from "@/lib/feed/types"
import {
  artistRefsFromCredit,
  decodeEntities,
  encodeEntities,
  entitiesOfItem,
  type EntityRef,
  labeledEntitiesOfItem,
} from "./entities"
import {
  HALF_LIFE_DAYS,
  type Signal,
  type SignalKind,
  computeAffinity,
  decay,
  isColdStart,
  topEntities,
} from "./model"
import { pageReasons, personalNicheOrder, personalizePage, reasonFor } from "./rank"

const DAY = 24 * 3600_000
const NOW = Date.parse("2026-10-16T12:00:00Z")

const signal = (
  kind: SignalKind,
  entity: EntityRef,
  daysAgo = 0,
  label = entity.split(":")[1],
  strength = 1,
): Signal => ({ kind, entity, label, strength, at: NOW - daysAgo * DAY })

const item = (id: string, over: Partial<FeedItem> = {}): FeedItem => ({
  id,
  source: "news",
  type: "article",
  title: id,
  subtitle: null,
  imageUrl: null,
  url: "https://example.com",
  publishedAt: null,
  score: 1,
  meta: {},
  ...over,
})

describe("entities", () => {
  it("splits multi-artist credits into artist refs", () => {
    expect(artistRefsFromCredit("evilgiane, xaviersobased & Nettspend")).toEqual([
      "artist:evilgiane",
      "artist:xaviersobased",
      "artist:nettspend",
    ])
    expect(artistRefsFromCredit("Ken Carson feat. Destroy Lonely")).toEqual([
      "artist:ken-carson",
      "artist:destroy-lonely",
    ])
  })

  it("round-trips through meta and ignores junk", () => {
    expect(decodeEntities(encodeEntities(["artist:a", "niche:b", "artist:a"]))).toEqual([
      "artist:a",
      "niche:b",
    ])
    expect(decodeEntities("artist:ok,DROP TABLE,brand:")).toEqual(["artist:ok"])
  })

  it("knows what a card is about, including the page's niche", () => {
    const track = item("t", { source: "spotify", type: "track", subtitle: "Nettspend" })
    expect(entitiesOfItem(track, "jerk")).toEqual(["artist:nettspend", "niche:jerk"])
    const brand = item("b", { source: "subcult", type: "brand", meta: { brandSlug: "rick-owens" } })
    expect(entitiesOfItem(brand)).toEqual(["brand:rick-owens"])
  })
})

describe("affinity", () => {
  it("halves every 14 days", () => {
    expect(decay(0)).toBe(1)
    expect(decay(HALF_LIFE_DAYS * DAY)).toBeCloseTo(0.5)
    expect(decay(2 * HALF_LIFE_DAYS * DAY)).toBeCloseTo(0.25)
  })

  it("recent taste outweighs old taste", () => {
    const vector = computeAffinity(
      [
        signal("save", "artist:old-fave", 42),
        signal("save", "artist:old-fave", 42),
        signal("save", "artist:new-fave", 0),
      ],
      NOW,
    )
    expect(topEntities(vector).map((a) => a.entity)).toEqual(["artist:new-fave", "artist:old-fave"])
  })

  it("remembers the strongest reason and lets dislikes go negative", () => {
    const vector = computeAffinity(
      [
        signal("open", "artist:nettspend"),
        signal("play_through", "artist:nettspend"),
        signal("not_my_vibe", "niche:cottagecore"),
      ],
      NOW,
    )
    expect(vector.get("artist:nettspend")).toMatchObject({ score: 3, because: "play_through" })
    expect(vector.get("niche:cottagecore")?.score).toBe(-5)
    expect(topEntities(vector).map((a) => a.entity)).toEqual(["artist:nettspend"])
  })

  it("a vibe check alone is enough to leave cold start", () => {
    expect(isColdStart(computeAffinity([], NOW))).toBe(true)
    const seeded = computeAffinity([signal("vibe_check", "niche:rage", 0, "rage", 0.6)], NOW)
    expect(isColdStart(seeded)).toBe(false)
  })
})

describe("personalizePage", () => {
  const vector = computeAffinity(
    [signal("save", "brand:rick-owens", 0, "Rick Owens"), signal("not_my_vibe", "artist:bad")],
    NOW,
  )
  const brand = (id: string, slug: string) =>
    item(id, { source: "subcult", type: "brand", meta: { brandSlug: slug } })

  it("moves liked entities up within their mix kind only", () => {
    const page = [
      item("news-1"),
      brand("b-other", "supreme"),
      item("news-2"),
      brand("b-rick", "rick-owens"),
    ]
    const ranked = personalizePage(page, vector, new Set())
    expect(ranked.map((i) => i.id)).toEqual(["news-1", "b-rick", "news-2", "b-other"])
  })

  it("hides not-my-vibe items and pushes seen ones back", () => {
    const page = [
      item("seen", { meta: { entities: "brand:rick-owens" } }),
      item("fresh", { meta: { entities: "brand:rick-owens" } }),
      item("bad", { meta: { entities: "artist:bad" } }),
    ]
    expect(personalizePage(page, vector, new Set(["seen"])).map((i) => i.id)).toEqual([
      "fresh",
      "seen",
    ])
  })

  it("leaves a cold-start page untouched", () => {
    const page = [item("a"), item("b")]
    expect(personalizePage(page, new Map(), new Set())).toEqual(page)
  })
})

describe("personalNicheOrder", () => {
  const base = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"]
  const hops: Record<string, string[]> = { c: ["x-not-in-base", "k", "l"], f: ["l", "j"] }

  it("defaults to today's order without taste", () => {
    expect(personalNicheOrder(base, new Map(), () => []).map((n) => n.slug)).toEqual(base)
  })

  it("leads with your niches, explores two hops out ~1 page in 7, dislikes last", () => {
    const scores = new Map([
      ["f", 2],
      ["c", 5],
      ["b", 1],
      ["d", 3],
      ["e", 4],
      ["g", 0.5],
      ["a", -5],
    ])
    const order = personalNicheOrder(base, scores, (slug) => hops[slug] ?? [])
    expect(order.slice(0, 7).map((n) => n.slug)).toEqual(["c", "e", "d", "f", "b", "g", "k"])
    expect(order[6]).toEqual({ slug: "k", why: "explore", from: "c" })
    expect(order.map((n) => n.slug).at(-1)).toBe("a")
    expect(new Set(order.map((n) => n.slug))).toEqual(new Set(base))
  })
})

describe("reasonFor", () => {
  it("cites the real signal behind a personalized card", () => {
    const vector = computeAffinity(
      [
        signal("play", "artist:nettspend", 0, "Nettspend"),
        signal("save", "brand:rick-owens", 0, "Rick Owens"),
        signal("vibe_check", "niche:rage", 0, "rage", 0.5),
      ],
      NOW,
    )
    const track = item("t", { source: "spotify", type: "track", subtitle: "Nettspend" })
    expect(reasonFor(track, vector)).toBe("Because you played Nettspend")
    const brand = item("b", { source: "subcult", type: "brand", meta: { brandSlug: "rick-owens" } })
    expect(reasonFor(brand, vector)).toBe("Because you saved Rick Owens")
    expect(reasonFor(item("n"), vector, "rage")).toBe("From your vibe check: rage")
    expect(reasonFor(item("x"), vector, "jerk")).toBeNull()
  })

  it("labels exploration pages honestly", () => {
    const vector = computeAffinity([signal("follow", "niche:rage", 0, "rage")], NOW)
    expect(
      reasonFor(item("x"), vector, "jerk", { slug: "jerk", why: "explore", from: "rage" }),
    ).toBe("New to you · close to rage")
  })
})

describe("labeled entities", () => {
  it("keeps display names for reasons, never splitting names on the letter x", () => {
    const track = item("t", {
      source: "spotify",
      type: "track",
      subtitle: "Xaviersobased & Nettspend",
    })
    expect(labeledEntitiesOfItem(track, { slug: "jerk", name: "jerk" })).toEqual([
      { ref: "artist:xaviersobased", label: "Xaviersobased" },
      { ref: "artist:nettspend", label: "Nettspend" },
      { ref: "niche:jerk", label: "jerk" },
    ])
  })

  it("reads names from meta.entities", () => {
    const card = item("c", {
      meta: { entities: encodeEntities([{ ref: "brand:rick-owens", label: "Rick Owens" }]) },
    })
    expect(labeledEntitiesOfItem(card)).toEqual([{ ref: "brand:rick-owens", label: "Rick Owens" }])
  })
})

describe("pageReasons", () => {
  it("says the page-level reason once and card-specific reasons on each card", () => {
    const vector = computeAffinity(
      [
        signal("follow", "niche:jerk", 0, "jerk"),
        signal("save", "brand:rick-owens", 0, "Rick Owens"),
      ],
      NOW,
    )
    const brand = item("b", { source: "subcult", type: "brand", meta: { brandSlug: "rick-owens" } })
    expect(pageReasons([item("a"), item("c"), brand], vector, "jerk")).toEqual([
      "Because you follow jerk",
      null,
      "Because you saved Rick Owens",
    ])
  })
})
