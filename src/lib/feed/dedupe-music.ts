import type { FeedItem } from "./types"

const SPOTIFY_TRACK_ID = /^spotify:track:([A-Za-z0-9]{10,40})$/
const SPOTIFY_TRACK_URL = /open\.spotify\.com\/track\/([A-Za-z0-9]{10,40})/

const isMusic = (item: FeedItem) =>
  item.type === "track" || item.type === "release" || item.source === "spotify"

/** "Magnolia (feat. X) - Remastered" → "magnolia". */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s*[([].*?[)\]]/g, "")
    .replace(/\s+-\s+.*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * Every key a track is known by: its Spotify track id (from the id or the
 * link) and its title + lead artist, so the same song from Spotify, an
 * iTunes soundtrack preview and another niche counts once.
 */
export function musicKeys(item: FeedItem): string[] {
  if (!isMusic(item) || item.type === "playlist" || item.type === "artist") return []
  const spotifyId = SPOTIFY_TRACK_ID.exec(item.id)?.[1] ?? SPOTIFY_TRACK_URL.exec(item.url)?.[1]
  const lead = (item.subtitle ?? "").split(/,|&| x | feat\.? /i)[0] ?? ""
  const title = normalize(item.title)
  return [
    ...(spotifyId ? [`spotify:${spotifyId}`] : []),
    ...(title ? [`song:${title}|${normalize(lead)}`] : []),
  ]
}

/**
 * Drops repeat songs (keeps the first), across sources and niches. Pass a
 * shared `seen` set to dedupe across pages or sections.
 */
export function dedupeMusic(items: readonly FeedItem[], seen: Set<string> = new Set()): FeedItem[] {
  return items.filter((item) => {
    const keys = musicKeys(item)
    if (keys.some((key) => seen.has(key))) return false
    for (const key of keys) seen.add(key)
    return true
  })
}
