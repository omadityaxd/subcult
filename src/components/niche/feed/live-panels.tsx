import { Clapperboard, ListMusic, Newspaper } from "lucide-react"
import { connection } from "next/server"
import { cache } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { env } from "@/lib/env"
import { type NicheFeed, buildNicheFeed } from "@/lib/feed/feed"
import { createFeedDeps } from "@/lib/feed/server"
import type { FeedItem } from "@/lib/feed/types"
import { googleNews, spotify, youtube } from "@/lib/links"
import { log } from "@/lib/log"
import { getRedis } from "@/lib/redis"
import { LinkCard, SectionHeading } from "../link-card"
import { SearchLinksSection } from "../sections/search-links-section"
import { SoundsSection } from "../sections/sounds-section"
import { FeedCard } from "./feed-card"

const FOR_YOU_LIMIT = 24

/** One feed build per request, shared by every tab (React request memo). */
const getNicheFeed = cache(async (profile: NicheProfile): Promise<NicheFeed> => {
  await connection()
  return buildNicheFeed(
    profile,
    createFeedDeps({
      spotifyClientId: env.SPOTIFY_CLIENT_ID,
      spotifyClientSecret: env.SPOTIFY_CLIENT_SECRET,
      youtubeApiKey: env.YOUTUBE_API_KEY,
      redis: getRedis(),
      logger: log,
    }),
  )
})

function FeedList({ items, now }: { items: readonly FeedItem[]; now: Date }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          <FeedCard item={item} now={now} />
        </li>
      ))}
    </ul>
  )
}

/** The mixed, ranked, interleaved For You feed. */
export async function LiveForYou({ profile }: { profile: NicheProfile }) {
  const feed = await getNicheFeed(profile)
  if (feed.items.length === 0) return null
  return (
    <section className="mt-8">
      <SectionHeading>the feed 🔥</SectionHeading>
      <FeedList items={feed.items.slice(0, FOR_YOU_LIMIT)} now={new Date()} />
    </section>
  )
}

/** Live Spotify results (embed + art grid); deep links when Spotify is off or empty. */
export async function LiveSounds({ profile }: { profile: NicheProfile }) {
  const feed = await getNicheFeed(profile)
  const items = feed.bySource.spotify ?? []
  if (items.length === 0) return <SoundsSection profile={profile} />

  const spotlight = items.find((item) => item.type === "track")
  const artists = items.filter((item) => item.type === "artist")
  const rest = items.filter((item) => item.type !== "artist" && item !== spotlight)
  const embedUrl = typeof spotlight?.meta.embedUrl === "string" ? spotlight.meta.embedUrl : null

  return (
    <div className="space-y-8">
      {spotlight && embedUrl ? (
        <section>
          <SectionHeading>on rotation</SectionHeading>
          <iframe
            src={`${embedUrl}?utm_source=subcult&theme=0`}
            title={`${spotlight.title} on Spotify`}
            width="100%"
            height="152"
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            className="rounded-2xl border-0"
          />
        </section>
      ) : null}
      {artists.length > 0 ? (
        <section>
          <SectionHeading>the artists</SectionHeading>
          <FeedList items={artists} now={new Date()} />
        </section>
      ) : null}
      <section>
        <SectionHeading>tracks & playlists</SectionHeading>
        <FeedList items={rest} now={new Date()} />
      </section>
      <section>
        <SectionHeading>dig deeper</SectionHeading>
        <div className="grid grid-cols-2 gap-2">
          {profile.spotifyQueries.map((query) => (
            <LinkCard
              key={query}
              href={spotify.playlistSearch(query)}
              title={query}
              icon={<ListMusic aria-hidden className="size-5" />}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

/** Live headlines from Google News, plus the curated searches. */
export async function LiveTea({ profile }: { profile: NicheProfile }) {
  const feed = await getNicheFeed(profile)
  const items = feed.bySource.news ?? []
  return (
    <div className="space-y-8">
      {items.length > 0 ? (
        <section>
          <SectionHeading>the tea ☕</SectionHeading>
          <FeedList items={items} now={new Date()} />
        </section>
      ) : null}
      <SearchLinksSection
        heading={items.length > 0 ? "keep digging" : "the tea ☕"}
        intro="what the internet's saying about the scene right now."
        queries={profile.newsQueries}
        toUrl={googleNews.search}
        icon={<Newspaper aria-hidden className="size-5" />}
      />
    </div>
  )
}

/** Recent long-form videos (no Shorts), plus the curated searches. */
export async function LiveWatch({ profile }: { profile: NicheProfile }) {
  const feed = await getNicheFeed(profile)
  const items = feed.bySource.youtube ?? []
  return (
    <div className="space-y-8">
      {items.length > 0 ? (
        <section>
          <SectionHeading>fresh uploads</SectionHeading>
          <FeedList items={items} now={new Date()} />
        </section>
      ) : null}
      <SearchLinksSection
        heading={items.length > 0 ? "more to watch" : "watch"}
        intro="deep dives, hauls and full parts."
        queries={profile.youtubeQueries}
        toUrl={youtube.search}
        icon={<Clapperboard aria-hidden className="size-5" />}
      />
    </div>
  )
}

/** Skeleton loaders, never spinners. */
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="mt-8 space-y-3">
      <Skeleton className="h-6 w-32 rounded-lg" />
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-20 rounded-2xl" />
      ))}
    </div>
  )
}
