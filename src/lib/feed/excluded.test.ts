import { describe, expect, it } from "vitest"
import { findSeedProfile, findSeedProfileByName, TAXONOMY } from "@/lib/niches/catalog"
import { fitInputSchema } from "@/lib/fits/schema"
import { judgeItem } from "./clean"
import { isExcludedContent, isExcludedTopic } from "./excluded"
import { nicheCleanContext } from "./niche-relevance"
import type { FeedItem } from "./types"

const ctx = (slug: string) => {
  const profile = findSeedProfile(slug)
  if (!profile) throw new Error(`no ${slug}`)
  return nicheCleanContext(profile)
}

const item = (title: string, source: FeedItem["source"] = "youtube"): FeedItem => ({
  id: `x:${title}`,
  source,
  type: source === "news" ? "article" : "video",
  title,
  subtitle: null,
  imageUrl: null,
  url: "https://example.com",
  publishedAt: null,
  score: 0,
  meta: {},
})

describe("excluded entirely (regression)", () => {
  it.each([
    "Hardmaxxing guide: what nobody tells you",
    "Rating my face on the PSL scale",
    "He is mogging everyone in this clip",
    "Bonesmashing results after 30 days",
    "My first tren cycle, honest review",
    "SARMs vs steroids for aesthetics",
    "The blackpill explained",
    "Why incels think looks are everything",
  ])("never shows %j, in any niche", (title) => {
    for (const slug of ["softmaxxing", "gymtok", "streamer-culture", "rage", "anime"]) {
      expect(judgeItem(item(title), ctx(slug)), slug).toBe("excluded")
      expect(judgeItem(item(title, "news"), ctx(slug)), slug).toBe("excluded")
    }
  })

  it.each([
    "Jaw surgery before and after transformation",
    "Rhinoplasty at 19: my glow up",
    "Water fasting for 7 days to get lean",
    "Buccal fat removal results",
  ])("keeps surgery promotion and extreme dieting out of Glow-Up: %j", (title) => {
    for (const slug of [
      "softmaxxing",
      "male-grooming",
      "gen-z-skincare",
      "gymtok",
      "self-improvement",
    ]) {
      expect(judgeItem(item(title), ctx(slug)), slug).toBe("excluded")
    }
  })

  it("scopes those words to Glow-Up, so other scenes keep their meaning", () => {
    expect(isExcludedContent("Every Naruto fillers episode ranked")).toBe(false)
    expect(isExcludedContent("Every Naruto fillers episode ranked", { glowUp: true })).toBe(true)
  })

  it("keeps streamer drama and gossip about real people out of creator niches", () => {
    for (const title of [
      "Streamer drama exposed: the full story",
      "Streamer beef explained",
      "The allegations against a streamer, explained",
    ]) {
      expect(judgeItem(item(title), ctx("streamer-culture"))).not.toBeNull()
    }
  })

  it("refuses to generate niches for excluded topics", () => {
    for (const name of [
      "hardmaxxing",
      "bonesmashing",
      "blackpill",
      "PSL rating",
      "SARMs",
      "steroid cycles",
    ]) {
      expect(isExcludedTopic(name), name).toBe(true)
    }
    expect(isExcludedTopic("softmaxxing")).toBe(false)
    expect(isExcludedTopic("gen-z skincare")).toBe(false)
  })

  it("rejects fit captions with excluded content", () => {
    const base = { niches: ["softmaxxing"], brands: [], pieces: [], song: null }
    expect(fitInputSchema.safeParse({ ...base, caption: "day 30 of bonesmashing" }).success).toBe(
      false,
    )
    expect(fitInputSchema.safeParse({ ...base, caption: "fresh cut, new fit" }).success).toBe(true)
  })

  it("keeps healthy glow-up content", () => {
    for (const title of [
      "Simple skincare routine for beginners",
      "How to ask your barber for a taper",
      "Science based push pull legs routine",
    ]) {
      expect(isExcludedContent(title, { glowUp: true })).toBe(false)
    }
  })
})

describe("new niches are findable", () => {
  it("routes the main looksmaxxing alias to the grooming-first page", () => {
    expect(findSeedProfileByName("looksmaxxing")?.slug).toBe("softmaxxing")
    expect(findSeedProfileByName("men's grooming")?.slug).toBe("male-grooming")
    expect(findSeedProfileByName("internet meme culture")?.slug).toBe("brainrot-and-meme-culture")
    expect(findSeedProfileByName("egirl")?.slug).toBe("e-boy-and-e-girl")
  })

  it("puts them under their hubs with the brief's typed relationships", () => {
    expect(TAXONOMY.children("glow-up")).toEqual([
      "softmaxxing",
      "male-grooming",
      "gen-z-skincare",
      "gymtok",
      "self-improvement",
    ])
    expect(TAXONOMY.children("creator-culture")).toContain("streamer-culture")
    const near = (slug: string) => TAXONOMY.adjacent(slug).map((a) => a.slug)
    expect(near("softmaxxing")).toContain("male-grooming")
    expect(near("male-grooming")).toContain("gen-z-skincare")
    expect(near("gymtok")).toEqual(expect.arrayContaining(["gym-rat", "self-improvement"]))
    expect(near("streamer-culture")).toEqual(
      expect.arrayContaining(["brainrot-and-meme-culture", "new-gen-underground-rap"]),
    )
  })

  it("only features creators inside the guardrails", () => {
    const featured = TAXONOMY.allCreators()
      .filter((c) => c.featured)
      .map((c) => c.slug)
    for (const unsure of ["kai-cenat", "ishowspeed", "sketch", "stable-ronaldo", "plaqueboymax"]) {
      expect(featured).not.toContain(unsure)
    }
    expect(TAXONOMY.creatorsOf("gen-z-skincare").map((c) => c.slug)).toContain("hyram")
  })
})
