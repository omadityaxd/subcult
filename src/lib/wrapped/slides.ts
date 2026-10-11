import { z } from "zod"
import type { WrappedSummary } from "./stats"

/**
 * One Wrapped slide, as data. The client renders it as a story frame and the
 * server renders the same spec as a 1080×1920 share image, so they match.
 */
const ARTWORK_HOSTS = [/^i\.scdn\.co$/, /^[a-z0-9-]+\.mzstatic\.com$/]

/** Only our two artwork CDNs: the image renderer fetches these URLs server-side. */
export const artworkUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value)
      return url.protocol === "https:" && ARTWORK_HOSTS.some((host) => host.test(url.hostname))
    } catch {
      return false
    }
  }, "artwork must come from Spotify or Apple's CDN")

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
const short = z.string().min(1).max(80)

export const slideSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("intro"), since: z.number() }),
  z.object({ kind: z.literal("minutes"), minutes: z.number().int().min(0).max(10_000_000) }),
  z.object({
    kind: z.literal("niches"),
    niches: z
      .array(z.object({ slug, percent: z.number().int().min(0).max(100) }))
      .min(1)
      .max(3),
  }),
  z.object({
    kind: z.literal("artists"),
    artists: z
      .array(
        z.object({
          name: short,
          minutes: z.number().int().min(0),
          imageUrl: artworkUrlSchema.nullable(),
        }),
      )
      .min(1)
      .max(5),
  }),
  z.object({
    kind: z.literal("tracks"),
    tracks: z
      .array(z.object({ title: short, artist: short, artworkUrl: artworkUrlSchema.nullable() }))
      .min(1)
      .max(5),
  }),
  z.object({
    kind: z.literal("discovered"),
    count: z.number().int().min(0),
    slugs: z.array(slug).max(6),
  }),
  z.object({
    kind: z.literal("era"),
    slug,
    share: z.number().int().min(0).max(100),
  }),
])
export type Slide = z.infer<typeof slideSchema>

/** The deck for a summary: only slides with something real to say. */
export function buildSlides(
  summary: WrappedSummary,
  artistImage: (name: string) => string | null,
): Slide[] {
  const slides: Slide[] = [{ kind: "intro", since: summary.since }]
  if (summary.minutesListened > 0)
    slides.push({ kind: "minutes", minutes: summary.minutesListened })
  if (summary.topNiches.length > 0) slides.push({ kind: "niches", niches: summary.topNiches })
  if (summary.topArtists.length > 0) {
    slides.push({
      kind: "artists",
      artists: summary.topArtists.map((artist) => ({
        ...artist,
        imageUrl: safeArtwork(artistImage(artist.name)),
      })),
    })
  }
  if (summary.topTracks.length > 0) {
    slides.push({
      kind: "tracks",
      tracks: summary.topTracks.map(({ title, artist, artworkUrl }) => ({
        title: title.slice(0, 80),
        artist: artist.slice(0, 80),
        artworkUrl: safeArtwork(artworkUrl),
      })),
    })
  }
  if (summary.nichesDiscovered > 0) {
    slides.push({
      kind: "discovered",
      count: summary.nichesDiscovered,
      slugs: summary.discovered.slice(0, 6),
    })
  }
  if (summary.era) slides.push({ kind: "era", ...summary.era })
  return slides
}

function safeArtwork(url: string | null): string | null {
  return url && artworkUrlSchema.safeParse(url).success ? url : null
}

/** The niche whose palette dresses a slide. */
export function slideNiche(slide: Slide, fallback: string | null): string | null {
  switch (slide.kind) {
    case "niches":
      return slide.niches[0]?.slug ?? fallback
    case "era":
      return slide.slug
    case "discovered":
      return slide.slugs[0] ?? fallback
    default:
      return fallback
  }
}
