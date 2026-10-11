import type { Slide } from "./slides"

export interface SlideCopy {
  overline: string
  /** Big serif line. */
  headline: string
  /** One supporting line. */
  caption?: string
  /** Ranked rows (niches, artists, tracks) where the slide has them. */
  rows?: {
    label: string
    detail?: string
    percent?: number
    imageUrl?: string | null
    slug?: string
  }[]
}

const monthDay = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })

function minutesQuip(minutes: number): string {
  if (minutes < 60) return "Just getting started. The underground is patient."
  if (minutes < 600) return "That's a lot of 30-second previews. Respect."
  return "Your speakers deserve hazard pay."
}

/** The words on each Wrapped slide (shared by the in-app story and the export image). */
export function slideCopy(slide: Slide, nameOf: (slug: string) => string): SlideCopy {
  switch (slide.kind) {
    case "intro":
      return {
        overline: "subcult wrapped",
        headline: "Your niches, unpacked",
        caption: `Everything you played and explored since ${monthDay(slide.since)}.`,
      }
    case "minutes":
      return {
        overline: "You listened for",
        headline: `${slide.minutes.toLocaleString("en-US")} ${slide.minutes === 1 ? "minute" : "minutes"}`,
        caption: minutesQuip(slide.minutes),
      }
    case "niches":
      return {
        overline: "Your top niches",
        headline: `${slide.niches[0].percent}% ${nameOf(slide.niches[0].slug)}`,
        rows: slide.niches.map((niche) => ({
          label: nameOf(niche.slug),
          percent: niche.percent,
          slug: niche.slug,
        })),
      }
    case "artists":
      return {
        overline: "Your top artists",
        headline: slide.artists[0].name,
        caption: `${slide.artists[0].minutes} min together. They know who you are.`,
        rows: slide.artists.map((artist) => ({
          label: artist.name,
          detail: `${artist.minutes} min`,
          imageUrl: artist.imageUrl,
        })),
      }
    case "tracks":
      return {
        overline: "On repeat",
        headline: slide.tracks[0].title,
        caption: slide.tracks[0].artist,
        rows: slide.tracks.map((track) => ({
          label: track.title,
          detail: track.artist,
          imageUrl: track.artworkUrl,
        })),
      }
    case "discovered":
      return {
        overline: "Rabbit holes",
        headline: `${slide.count} ${slide.count === 1 ? "niche" : "niches"} discovered`,
        caption: slide.slugs.map(nameOf).join(" · "),
      }
    case "era":
      return {
        overline: "Right now",
        headline: `Your ${nameOf(slide.slug)} era`,
        caption: `${slide.share}% of your listening this month. No notes.`,
      }
  }
}
