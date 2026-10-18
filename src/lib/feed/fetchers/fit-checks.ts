import type { NicheProfile } from "@/lib/engine/profile-schema"
import { addDays } from "@/lib/niches/lifecycle"
import { searchYoutube } from "@/lib/sources/youtube"
import { QuotaExhaustedError, type QuotaGuard } from "../quota"
import type { FeedItem, Fetcher } from "../types"

const LOOKBACK_DAYS = 365
const MAX_RESULTS = 15
const KEEP = 8

/** A title that's about clothes: "fit check", "outfit", "what I wore", "OOTD"… */
export const FIT_WORDS =
  /\b(fit ?checks?|fits|outfits?|ootd|what i wore|what i'?m wearing|lookbook|styling|get ready with me|grwm|haul)\b/i

export interface FitCheckTerms {
  /** Verified names to search with: lead artists and the niche's brands. */
  names: readonly string[]
}

/** `("Rick Owens" | "Playboi Carti" | "vamp") fit check`: YouTube's OR syntax, then the fit words. */
export function fitCheckQuery(profile: NicheProfile, terms: FitCheckTerms | null): string {
  const names = [...(terms?.names ?? []), profile.name].slice(0, 3)
  return `${names.map((name) => `"${name}"`).join(" | ")} fit check`
}

/**
 * Fit-check and outfit videos (Shorts allowed: these play in the Reels
 * viewer), searched by the niche's verified artists and brands. A separate
 * fetcher with a 24h refresh so it costs at most one search per niche a day
 * from the shared YouTube budget. The relevance pipeline still decides:
 * a fit word plus a verified entity or the niche's phrase (see clean.ts).
 */
export function fitCheckFetcher(
  apiKey: string,
  quota: QuotaGuard,
  termsFor: (profile: NicheProfile) => FitCheckTerms | null,
  fetchImpl: typeof fetch = fetch,
): Fetcher {
  return {
    source: "youtube",
    freshSeconds: 24 * 3600,
    staleSeconds: 7 * 24 * 3600,
    cacheVersion: "fit1",
    async fetch(profile: NicheProfile) {
      if (!(await quota.tryConsume())) throw new QuotaExhaustedError("youtube")
      const videos = await searchYoutube(fitCheckQuery(profile, termsFor(profile)), {
        apiKey,
        publishedAfter: addDays(new Date(), -LOOKBACK_DAYS),
        order: "relevance",
        videoDuration: "short",
        regionCode: "US",
        relevanceLanguage: "en",
        maxResults: MAX_RESULTS,
        fetchImpl,
      })
      return videos
        .filter((video) => FIT_WORDS.test(video.title))
        .slice(0, KEEP)
        .map((video): FeedItem => ({
          id: `youtube:fit:${video.id}`,
          source: "youtube",
          type: "video",
          title: video.title,
          subtitle: video.channel,
          imageUrl: video.thumbnailUrl,
          url: video.url,
          publishedAt: video.publishedAt?.toISOString() ?? null,
          score: 0,
          meta: {
            channel: video.channel,
            embedUrl: `https://www.youtube-nocookie.com/embed/${video.id}`,
            // Fits chip + The Fit; Shorts open in the Reels viewer.
            fit: true,
            fitCheck: true,
            short: true,
          },
        }))
    },
  }
}
