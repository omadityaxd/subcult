import { describe, expect, it } from "vitest"
import { findSeedProfile } from "@/lib/niches/catalog"
import {
  canonicalUrl,
  cleanFeed,
  dedupe,
  foreignLanguages,
  judgeItem,
  titleSimilarity,
} from "./clean"
import { nicheCleanContext } from "./niche-relevance"
import { DEFAULT_SOURCES } from "./source-tiers"
import type { FeedItem } from "./types"

const contextFor = (slug: string) => {
  const profile = findSeedProfile(slug)
  if (!profile) throw new Error(`no seed profile for ${slug}`)
  return nicheCleanContext(profile)
}

let n = 0
const video = (title: string, channel: string): FeedItem => ({
  id: `youtube:video:${++n}`,
  source: "youtube",
  type: "video",
  title,
  subtitle: channel,
  imageUrl: null,
  url: `https://www.youtube.com/watch?v=v${n}`,
  publishedAt: null,
  score: 0,
  meta: { channel },
})

const article = (title: string, domain: string, url = `https://${domain}/a/${++n}`): FeedItem => ({
  id: `news:article:${++n}`,
  source: "news",
  type: "article",
  title,
  subtitle: domain,
  imageUrl: null,
  url,
  publishedAt: null,
  score: 0,
  meta: { outlet: domain, domain },
})

// The exact items from the brief that leaked into real feeds.
describe("regression: the junk from the brief", () => {
  it('drops "Opium War | China vs Britain" under vamp', () => {
    const ctx = contextFor("vamp")
    expect(judgeItem(video("Opium War | China vs Britain", "History Matters"), ctx)).not.toBeNull()
    expect(judgeItem(article("Opium War | China vs Britain", "britannica.com"), ctx)).not.toBeNull()
  })

  it('drops "Playlist Việt Jerk Drill" and "I Made a SOULFUL JERK Beat" under jerk', () => {
    const ctx = contextFor("jerk")
    expect(judgeItem(video("Playlist Việt Jerk Drill", "Nhạc Hay"), ctx)).toBe("language")
    expect(judgeItem(video("I Made a SOULFUL JERK Beat", "prodbyx"), ctx)).toBe("spam")
  })

  it("drops the claypot restaurant ad under digicore", () => {
    const ad = article(
      "The Soup Expert Buy 1 Get 1 Free Claypots at Suntec City: $40 Nett Spend, Till 31 Oct 2026",
      "misslobang.com",
    )
    expect(judgeItem(ad, contextFor("digicore"))).not.toBeNull()
  })

  it('drops generic "Raw Underground Rap Track Revealed LIVE" uploads', () => {
    const generic = video("Raw Underground Rap Track Revealed LIVE", "Rap Spot TV")
    for (const slug of ["underground-rap", "new-gen-underground-rap", "rage"]) {
      expect(judgeItem(generic, contextFor(slug)), slug).toBe("irrelevant")
    }
  })

  it("drops the regional Odisha rap show", () => {
    const show = video("Odisha's Biggest Rap Show | Odia Hip Hop Live 2026", "Odisha TV")
    expect(judgeItem(show, contextFor("new-gen-underground-rap"))).toBe("region")
    expect(judgeItem(show, contextFor("underground-rap"))).toBe("region")
  })

  it("keeps only one copy of the same VICE article", () => {
    const title = "3 Underground Rappers Who Have Been Quietly Making Fantastic Albums for Years"
    const feed = cleanFeed(
      [
        article(title, "vice.com", "https://www.vice.com/en/article/underground-rappers/"),
        article(title, "vice.com", "https://vice.com/en/article/underground-rappers?utm_source=gn"),
        article(`${title} - VICE`, "vice.com", "https://news.google.com/rss/articles/CBMiX"),
      ],
      { ...contextFor("underground-rap"), terms: null },
    )
    expect(feed).toHaveLength(1)
  })

  it("drops type beats and free beats that name-drop real artists", () => {
    const ctx = contextFor("jerk")
    expect(
      judgeItem(video("(free) xaviersobased + ksuuvi + jerk type beat - spiral", "x"), ctx),
    ).toBe("spam")
    expect(judgeItem(video("*free digicore beat* D4NC3!", "y"), contextFor("digicore"))).toBe(
      "spam",
    )
  })
})

describe("judgeItem keeps the real thing", () => {
  it("keeps an artist's own upload and trusted-outlet coverage", () => {
    expect(
      judgeItem(video("Ken Carson - Margiela (Official Video)", "Ken Carson"), contextFor("rage")),
    ).toBeNull()
    expect(
      judgeItem(
        article("The 10 Best Playboi Carti Outfits, Ranked", "complex.com"),
        contextFor("vamp"),
      ),
    ).toBeNull()
  })

  it("asks more of unknown sources than trusted ones", () => {
    const ctx = contextFor("rage")
    // A multi-word niche phrase is enough from a trusted outlet, not from an unknown one.
    const phraseOnly = "Why rage rap took over the underground"
    expect(judgeItem(article(phraseOnly, "pitchfork.com"), ctx)).toBeNull()
    expect(judgeItem(article(phraseOnly, "randomblog.net"), ctx)).toBe("irrelevant")
  })

  it("needs an up-front credit from unknown YouTube channels, not a name-drop", () => {
    const ctx = contextFor("rage")
    expect(
      judgeItem(video("Ken Carson - shopping (ft. Destroy Lonely)", "fan uploads"), ctx),
    ).toBeNull()
    expect(judgeItem(video("More Very Bad News For Playboi Carti", "Poetik Flakko"), ctx)).toBe(
      "irrelevant",
    )
  })

  it("never treats a YouTube link as news", () => {
    expect(judgeItem(article("Ken Carson - Overseas", "youtu.be"), contextFor("rage"))).toBe(
      "blocked",
    )
  })

  it("lets non-English niches keep their language", () => {
    const ctx = contextFor("k-pop")
    expect(ctx.languages).toContain("ko")
    expect(
      judgeItem(video("NewJeans (뉴진스) 'Supernatural' Official MV", "HYBE LABELS"), ctx),
    ).not.toBe("language")
  })
})

describe("foreignLanguages", () => {
  it("spots Vietnamese, Indic and Romance titles; English stays clean", () => {
    expect(foreignLanguages("Playlist Việt Jerk Drill")).toContain("vi")
    expect(foreignLanguages("ଓଡ଼ିଆ ର‍୍ୟାପ")).toContain("other")
    expect(foreignLanguages("La mejor canción para los fans")).toContain("romance")
    expect(foreignLanguages("Beyoncé – Cowboy Carter (Live)").size).toBe(0)
  })
})

describe("canonicalUrl / dedupe", () => {
  it("collapses tracking params, www, trailing slashes and YouTube URL shapes", () => {
    expect(canonicalUrl("https://www.vice.com/a/?utm_source=x#top")).toBe(
      canonicalUrl("https://vice.com/a"),
    )
    expect(canonicalUrl("https://youtu.be/abc123")).toBe(
      canonicalUrl("https://www.youtube.com/watch?v=abc123&feature=share"),
    )
    expect(canonicalUrl("https://youtube.com/shorts/abc123")).toBe("youtube:abc123")
  })

  it("treats syndicated near-identical titles as one item, preferring the trusted copy", () => {
    expect(
      titleSimilarity(
        "Playboi Carti and I.AM.GIA Collab Set to Debut at ComplexCon 2026",
        "Playboi Carti & I.AM.GIA Collab Set to Debut at ComplexCon 2026",
      ),
    ).toBeGreaterThanOrEqual(0.8)
    const kept = dedupe(
      [
        article("Playboi Carti and I.AM.GIA Collab Set to Debut at ComplexCon 2026", "yahoo.com"),
        article("Playboi Carti and I.AM.GIA Collab Set to Debut at ComplexCon 2026", "complex.com"),
      ],
      DEFAULT_SOURCES,
    )
    expect(kept.map((item) => item.meta.domain)).toEqual(["complex.com"])
  })

  it("keeps different stories that share a few words", () => {
    expect(
      titleSimilarity("Ken Carson announces new album", "Ken Carson cancels tour dates"),
    ).toBeLessThan(0.8)
  })
})
