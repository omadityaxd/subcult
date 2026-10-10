import { z } from "zod"

/** Bump when the profile shape changes so stale rows can be detected and regenerated. */
export const PROFILE_SCHEMA_VERSION = 1

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const SUBREDDIT = /^[A-Za-z0-9][A-Za-z0-9_]{1,20}$/
const HASHTAG = /^[A-Za-z0-9_]{2,60}$/
const EMOJI = /\p{Extended_Pictographic}/u

const text = (max: number) => z.string().min(1).max(max)
const list = <T extends z.ZodType>(item: T, min: number, max: number) =>
  z.array(item).min(min).max(max)

export const PRICE_TIERS = ["$", "$$", "$$$"] as const

export const nicheArtistSchema = z.object({
  name: text(60),
  why: text(160).describe("One short line on why they fit the niche"),
})

export const nicheBrandSchema = z.object({
  name: text(60),
  priceTier: z.enum(PRICE_TIERS),
  why: text(160),
})

/**
 * Everything the LLM writes. Constraints the structured-output API can't
 * enforce are passed to the model as hints and enforced here on parse.
 */
export const nicheProfileDraftSchema = z.object({
  name: text(48).describe("Display name, lowercase unless a proper noun needs caps"),
  emoji: z.string().min(1).max(16).regex(EMOJI).describe("Exactly one emoji"),
  tagline: text(90).describe("Short, funny, Gen-Z voice, not cringe"),
  description: z.string().min(40).max(420).describe("2-3 sentences"),
  palette: z.array(z.string().regex(HEX_COLOR)).length(5).describe("5 hex colors like #1a2b3c"),
  vibeWords: list(text(24), 5, 12),
  artists: list(nicheArtistSchema, 8, 12),
  spotifyQueries: list(text(60), 3, 8),
  subreddits: list(z.string().regex(SUBREDDIT), 2, 6).describe("Names only, no r/ prefix"),
  newsQueries: list(text(80), 2, 6),
  youtubeQueries: list(text(80), 3, 6),
  brands: list(nicheBrandSchema, 4, 10),
  shopKeywords: list(text(60), 5, 10),
  pinterestQueries: list(text(60), 2, 5),
  instagramHashtags: list(z.string().regex(HASHTAG), 3, 8).describe("No # prefix"),
  tiktokQueries: list(text(60), 2, 5),
  relatedNiches: list(text(40), 3, 6),
})

export const nicheProfileSchema = nicheProfileDraftSchema.extend({
  slug: z.string().min(1).max(64),
  schemaVersion: z.literal(PROFILE_SCHEMA_VERSION),
})

/** The full structured-output contract: a profile, or a friendly rejection. */
export const nicheGenerationOutputSchema = z.object({
  status: z.enum(["ok", "rejected"]),
  rejectionReason: z
    .string()
    .max(160)
    .nullable()
    .describe("Only when rejected: one friendly line in the app's voice"),
  profile: nicheProfileDraftSchema.nullable().describe("Only when status is ok"),
})

export type NicheArtist = z.infer<typeof nicheArtistSchema>
export type NicheBrand = z.infer<typeof nicheBrandSchema>
export type PriceTier = (typeof PRICE_TIERS)[number]
export type NicheProfileDraft = z.infer<typeof nicheProfileDraftSchema>
export type NicheProfile = z.infer<typeof nicheProfileSchema>
export type NicheGenerationOutput = z.infer<typeof nicheGenerationOutputSchema>
