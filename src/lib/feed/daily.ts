import "server-only"
import type { Brand } from "@/lib/taxonomy/schema"
import { getMoodboard } from "@/lib/moodboard/server"
import type { Pin } from "@/lib/moodboard/types"
import type { PlayableTrack } from "@/lib/music/playable"
import { getSoundtrack } from "@/lib/music/soundtrack-server"
import { TAXONOMY, findPreset } from "@/lib/niches/catalog"
import { featuredOrder } from "./featured"

/** Visual references worth leading with: external boards first, then scene photos. */
const LOOK_SOURCES: readonly Pin["source"][] = ["arena", "unsplash", "pexels", "artist"]
const SPINNING_NICHES = 3
const SPINNING_TRACKS = 12

export interface DailyPicks {
  /** A real image from a fashion niche's board, with its credit. */
  look: { pin: Pin; niche: { slug: string; name: string } } | null
  brand: { brand: Brand; niches: { slug: string; name: string }[] } | null
  /** Compact "now spinning" row: the day's first niches' soundtracks, interleaved. */
  spinning: PlayableTrack[]
}

/** Stable per-day pick: same answer all day, different tomorrow. */
export function dayIndex(day: string, length: number, salt = ""): number {
  let hash = 0
  for (const char of `${day}:${salt}`) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return length > 0 ? Math.abs(hash) % length : 0
}

const isFashionNiche = (slug: string) => TAXONOMY.branchOf(slug) === "underground-fashion"

async function lookOfTheDay(day: string, order: readonly string[]): Promise<DailyPicks["look"]> {
  const fashion = order.filter(isFashionNiche)
  for (let attempt = 0; attempt < fashion.length; attempt++) {
    const slug = fashion[(dayIndex(day, fashion.length, "look") + attempt) % fashion.length]
    const board = await getMoodboard(slug)
    const candidates = board.pins.filter((pin) => LOOK_SOURCES.includes(pin.source))
    const pin = candidates[dayIndex(day, candidates.length, slug)]
    const preset = findPreset(slug)
    if (pin && preset) return { pin, niche: { slug, name: preset.name } }
  }
  return null
}

function brandOfTheDay(day: string): DailyPicks["brand"] {
  const brands = TAXONOMY.allBrands().filter(
    (brand) => TAXONOMY.nichesOfBrand(brand.slug).length > 0,
  )
  const brand = brands[dayIndex(day, brands.length, "brand")]
  if (!brand) return null
  const niches = TAXONOMY.nichesOfBrand(brand.slug).flatMap((slug) => {
    const preset = findPreset(slug)
    return preset ? [{ slug, name: preset.name }] : []
  })
  return { brand, niches }
}

async function nowSpinning(order: readonly string[]): Promise<PlayableTrack[]> {
  const soundtracks = await Promise.all(order.slice(0, SPINNING_NICHES).map(getSoundtrack))
  const lists = soundtracks.map((soundtrack) =>
    (soundtrack?.tracks ?? []).map((track): PlayableTrack => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      artworkUrl: track.artworkUrl,
      spotifyUrl: track.spotifyUrl,
      previewUrl: track.previewUrl,
      appleUrl: track.appleUrl,
      niche: soundtrack?.slug ?? null,
    })),
  )
  const seen = new Set<string>()
  const out: PlayableTrack[] = []
  for (let i = 0; out.length < SPINNING_TRACKS && lists.some((list) => i < list.length); i++) {
    for (const list of lists) {
      const track = list[i]
      if (track && !seen.has(track.id) && out.length < SPINNING_TRACKS) {
        seen.add(track.id)
        out.push(track)
      }
    }
  }
  return out
}

export async function getDailyPicks(now: Date = new Date()): Promise<DailyPicks> {
  const day = now.toISOString().slice(0, 10)
  const order = featuredOrder(now).map((niche) => niche.slug)
  const [look, spinning] = await Promise.all([lookOfTheDay(day, order), nowSpinning(order)])
  return { look, brand: brandOfTheDay(day), spinning }
}
