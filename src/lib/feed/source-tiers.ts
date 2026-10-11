/**
 * Source tiers for news and video. A source on its branch's allowlist is
 * "trusted": a verified entity or a multi-word niche phrase qualifies an item.
 * Anything else is "unknown" and needs a strong (unambiguous) verified entity
 * in the title itself.
 *
 * Verified 2026-10-11:
 * - News domains: each resolves (403s are bot walls on live sites) and shows
 *   up in Google News results for the niches' own queries.
 * - YouTube channels: looked up with channels.list?forHandle; the names below
 *   are the exact `channelTitle` the Data API returns. Only channels with a
 *   real audience (10k+ subscribers) made the list.
 */

const MUSIC_NEWS = [
  "complex.com",
  "pitchfork.com",
  "thefader.com",
  "stereogum.com",
  "hotnewhiphop.com",
  "xxlmag.com",
  "theneedledrop.com",
  "billboard.com",
  "rollingstone.com",
  "clashmusic.com",
  "lyricallemonade.com",
  "dazeddigital.com",
  "i-d.co",
  "theface.com",
  "hypebeast.com",
  "highsnobiety.com",
  "nme.com",
  "consequence.net",
  "uproxx.com",
  "okayplayer.com",
  "vice.com",
  "onestowatch.com",
  "teenvogue.com",
  "wmagazine.com",
]

const FASHION_NEWS = [
  "hypebeast.com",
  "highsnobiety.com",
  "complex.com",
  "vogue.com",
  "gq.com",
  "dazeddigital.com",
  "i-d.co",
  "theface.com",
  "032c.com",
  "ssense.com",
  "grailed.com",
  "culted.com",
  "wwd.com",
  "businessoffashion.com",
  "wmagazine.com",
  "interviewmagazine.com",
  "crfashionbook.com",
  "sneakernews.com",
  "soleretriever.com",
  "nicekicks.com",
]

const METAL_NEWS = [
  "loudwire.com",
  "kerrang.com",
  "revolvermag.com",
  "metalinjection.net",
  "lambgoat.com",
  "theprp.com",
  "loudersound.com",
  "brooklynvegan.com",
  "rocksound.tv",
  "floodmagazine.com",
  "nme.com",
  "pitchfork.com",
  "stereogum.com",
  "consequence.net",
]

const MUSIC_CHANNELS = [
  "COLORS",
  "Genius",
  "Pitchfork",
  "Complex",
  "theneedledrop",
  "fantano",
  "No Jumper",
  "On The Radar Radio",
  "DJ Smallz Eyes",
  "Our Generation Music",
  "The FADER",
  "HotNewHipHop",
  "XXL",
  "audiomack",
  "Rolling Loud",
  "NPR Music",
  "Boiler Room",
  "Stereogum",
  "Billboard",
  "Billboard News",
]

const FASHION_CHANNELS = [
  "HYPEBEAST",
  "Highsnobiety",
  "Vogue",
  "Dazed",
  "SSENSE",
  "Fashion Roadman",
  "RICK OWENS",
  "Complex",
]

const METAL_CHANNELS = [
  "REVOLVER",
  "Rock Sound",
  "Metal Hammer",
  "Metal Injection",
  "lambgoat",
  "NME",
  "theneedledrop",
  "Pitchfork",
]

export interface SourceAllowlist {
  /** Bare hostnames (no www.); subdomains match too. */
  newsDomains: ReadonlySet<string>
  /** YouTube channel titles, compared case-insensitively. */
  channels: ReadonlySet<string>
}

const allowlist = (domains: string[], channels: string[]): SourceAllowlist => ({
  newsDomains: new Set(domains),
  channels: new Set(channels.map((name) => name.toLowerCase())),
})

export const BRANCH_SOURCES: Readonly<Record<string, SourceAllowlist>> = {
  "underground-music": allowlist(MUSIC_NEWS, MUSIC_CHANNELS),
  "underground-internet": allowlist(MUSIC_NEWS, MUSIC_CHANNELS),
  "underground-fashion": allowlist(FASHION_NEWS, FASHION_CHANNELS),
  "alt-metal-revival": allowlist(METAL_NEWS, METAL_CHANNELS),
}

/** Niches outside the taxonomy branches trust the union of every list. */
export const DEFAULT_SOURCES = allowlist(
  [...MUSIC_NEWS, ...FASHION_NEWS, ...METAL_NEWS],
  [...MUSIC_CHANNELS, ...FASHION_CHANNELS, ...METAL_CHANNELS],
)

/** Never news, whatever the query matched (video lives in its own lane). */
export const BLOCKED_NEWS_DOMAINS: ReadonlySet<string> = new Set([
  "youtube.com",
  "youtu.be",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
])

export const sourcesForBranch = (branch: string | undefined): SourceAllowlist =>
  (branch && BRANCH_SOURCES[branch]) || DEFAULT_SOURCES

/** "www.complex.com" → matches "complex.com"; "music.mxdwn.com" → only if listed. */
export function domainIn(domain: string | null | undefined, domains: ReadonlySet<string>): boolean {
  if (!domain) return false
  const host = domain.toLowerCase().replace(/^www\./, "")
  for (const listed of domains) {
    if (host === listed || host.endsWith(`.${listed}`)) return true
  }
  return false
}
