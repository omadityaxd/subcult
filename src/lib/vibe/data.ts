import { z } from "zod"
import rawBlurbs from "../../../data/vibe-check/blurbs.json"
import rawCards from "../../../data/vibe-check/cards.json"
import rawLines from "../../../data/vibe-check/lines.json"
import { SEED_PROFILES, TAXONOMY, findSeedProfile, nicheImage } from "@/lib/niches/catalog"
import { type Blurbs, type NicheShare, blurbsSchema, templateBlurb, vibeCardSchema } from "./score"

/** Validated at module load: a bad card or blurb file fails the build, not the quiz. */
export const VIBE_CARDS = vibeCardSchema.array().min(8).max(16).parse(rawCards)
export const VIBE_BLURBS: Blurbs = blurbsSchema.parse(rawBlurbs)
/** ~10 one-liners per niche: the deck's text rotates between sessions. */
export const VIBE_LINES: Readonly<Record<string, readonly string[]>> = z
  .record(z.string(), z.array(z.string().min(8).max(80)).min(5))
  .parse(rawLines)

export interface PairSide {
  imageUrl: string
  label: string | null
  crop?: boolean
  weights: Record<string, number>
}

/** What the swipe deck needs on the client: no weights logic beyond the numbers. */
export interface DeckCard {
  id: string
  /** classic/line = a prompt card; fit/grail/pin/sound = today's real content; pair = this or that. */
  kind: "classic" | "line" | "fit" | "grail" | "pin" | "sound" | "pair"
  prompt: string
  imageUrl: string | null
  /** Generative-cover fallback (and tint) from the card's image niche or lead niche. */
  palette: readonly string[]
  coverSeed: string
  weights: Record<string, number>
  /** YouTube Shorts thumbnails: crop the pillarbox. */
  crop?: boolean
  /** What the picture really is: a brand, "seen on <artist>", a track. */
  credit?: string | null
  /** Sound cards: a 5-second preview. */
  previewUrl?: string | null
  pair?: { a: PairSide; b: PairSide }
}

function leadNiche(weights: Record<string, number>): string {
  return Object.entries(weights).sort(([, a], [, b]) => b - a)[0]?.[0] ?? ""
}

export function deckCards(): DeckCard[] {
  return VIBE_CARDS.map((card) => {
    const lead = card.image.kind === "niche" ? card.image.slug : leadNiche(card.weights)
    const imageUrl =
      card.image.kind === "artist"
        ? (TAXONOMY.artist(card.image.slug)?.imageUrl ?? null)
        : nicheImage(card.image.slug)
    return {
      id: card.id,
      kind: "classic" as const,
      prompt: card.prompt,
      imageUrl,
      palette: findSeedProfile(lead)?.palette ?? [
        "#0a0a0a",
        "#222222",
        "#555555",
        "#aaaaaa",
        "#f2f2f2",
      ],
      coverSeed: `${card.id}-${lead}`,
      weights: card.weights,
    }
  })
}

/** Display bits for a result niche (works for the share page and the result screen). */
export interface MixNiche extends NicheShare {
  name: string
  tagline: string
  palette: readonly string[]
  imageUrl: string | null
}

export function describeMix(mix: readonly NicheShare[]): MixNiche[] {
  return mix.flatMap((entry) => {
    const profile = findSeedProfile(entry.slug)
    return profile
      ? [
          {
            ...entry,
            name: profile.name,
            tagline: profile.tagline,
            palette: profile.palette,
            imageUrl: nicheImage(entry.slug),
          },
        ]
      : []
  })
}

export function vibeTemplateBlurb(mix: readonly NicheShare[]): string {
  return templateBlurb(mix, VIBE_BLURBS, {
    nameOf: (slug) => findSeedProfile(slug)?.name ?? slug,
    branchOf: (slug) => TAXONOMY.branchOf(slug),
  })
}

export const isCuratedNiche = (slug: string): boolean =>
  SEED_PROFILES.some((profile) => profile.slug === slug)
