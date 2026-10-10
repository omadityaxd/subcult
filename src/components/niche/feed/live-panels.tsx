import { connection } from "next/server"
import { cache } from "react"
import { MediaImage } from "@/components/ds/media-image"
import { SectionHeader } from "@/components/ds/section-header"
import { Skeleton } from "@/components/ui/skeleton"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { env } from "@/lib/env"
import { type NicheFeed, buildNicheFeed } from "@/lib/feed/feed"
import { createFeedDeps } from "@/lib/feed/server"
import type { FeedItem } from "@/lib/feed/types"
import { googleNews, spotify, youtube } from "@/lib/links"
import { log } from "@/lib/log"
import { getRedis } from "@/lib/redis"
import { cn } from "@/lib/utils"
import { LinkList } from "../link-card"
import { SoundsSection } from "../sections/sounds-section"
import { FeedCard } from "./feed-card"
import { ProgressiveList } from "./progressive-list"

/** One feed build per request, shared by every tab, the hero and the rail. */
export const getNicheFeed = cache(async (profile: NicheProfile): Promise<NicheFeed> => {
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

/** Masonry: 1 column on phones, 2 on tablets, 3 on wide screens. */
function Masonry({
  items,
  now,
  className,
}: {
  items: readonly FeedItem[]
  now: number
  className?: string
}) {
  return (
    <ProgressiveList
      className={cn("columns-1 gap-5 sm:columns-2 xl:columns-3", className)}
      itemClassName="mb-7 break-inside-avoid"
      items={items.map((item) => ({ key: item.id, node: <FeedCard item={item} now={now} /> }))}
    />
  )
}

export async function LiveForYou({ profile }: { profile: NicheProfile }) {
  const feed = await getNicheFeed(profile)
  if (feed.items.length === 0) return null
  return (
    <section className="mt-10">
      <SectionHeader overline="Ranked for you" title="Latest" />
      <Masonry items={feed.items} now={feed.generatedAt} />
    </section>
  )
}

export async function LiveSounds({ profile }: { profile: NicheProfile }) {
  const feed = await getNicheFeed(profile)
  const items = feed.bySource.spotify ?? []
  if (items.length === 0) return <SoundsSection profile={profile} />

  const spotlight = items.find((item) => item.type === "track")
  const embedUrl = typeof spotlight?.meta.embedUrl === "string" ? spotlight.meta.embedUrl : null
  const artists = items.filter((item) => item.type === "artist")
  const rest = items.filter((item) => item.type !== "artist")

  return (
    <div className="space-y-12">
      {spotlight && embedUrl ? (
        <section>
          <SectionHeader overline="Press play" title="On rotation" />
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
          <SectionHeader title="Artists" />
          <ul className="-mx-(--gutter) no-scrollbar flex gap-5 overflow-x-auto px-(--gutter)">
            {artists.map((artist) => (
              <li key={artist.id} className="w-24 shrink-0 text-center">
                <a
                  href={artist.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <span className="relative block aspect-square overflow-hidden rounded-full bg-muted transition-transform group-hover:scale-[1.03]">
                    {artist.imageUrl ? (
                      <MediaImage src={artist.imageUrl} alt="" sizes="96px" />
                    ) : null}
                  </span>
                  <span className="mt-2 block truncate text-footnote font-medium">
                    {artist.title}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <SectionHeader title="Tracks & playlists" />
        <Masonry
          items={rest}
          now={feed.generatedAt}
          className="columns-2 sm:columns-3 xl:columns-4"
        />
      </section>
      <section>
        <SectionHeader title="Dig deeper" />
        <LinkList
          links={profile.spotifyQueries.map((query) => ({
            title: query,
            href: spotify.playlistSearch(query),
            meta: "Spotify playlists",
          }))}
        />
      </section>
    </div>
  )
}

export async function LiveTea({ profile }: { profile: NicheProfile }) {
  const feed = await getNicheFeed(profile)
  const items = feed.bySource.news ?? []
  return (
    <div className="space-y-12">
      {items.length > 0 ? (
        <section>
          <SectionHeader overline="Last two weeks" title="The tea" />
          <Masonry items={items} now={feed.generatedAt} className="sm:columns-2 xl:columns-2" />
        </section>
      ) : null}
      <section>
        <SectionHeader title="Keep digging" />
        <LinkList
          links={profile.newsQueries.map((query) => ({
            title: query,
            href: googleNews.search(query),
            meta: "Google News",
          }))}
        />
      </section>
    </div>
  )
}

export async function LiveWatch({ profile }: { profile: NicheProfile }) {
  const feed = await getNicheFeed(profile)
  const items = feed.bySource.youtube ?? []
  const now = feed.generatedAt
  return (
    <div className="space-y-12">
      {items.length > 0 ? (
        <section>
          <SectionHeader overline="Long-form, no Shorts" title="Watch" />
          <ul className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <li key={item.id}>
                <FeedCard item={item} now={now} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <SectionHeader title="More to watch" />
        <LinkList
          links={profile.youtubeQueries.map((query) => ({
            title: query,
            href: youtube.search(query),
            meta: "YouTube",
          }))}
        />
      </section>
    </div>
  )
}

/** Hero mosaic: the niche's album art, when Spotify is configured. */
export async function HeroMosaic({ profile }: { profile: NicheProfile }) {
  const feed = await getNicheFeed(profile)
  const art = (feed.bySource.spotify ?? [])
    .filter((item) => item.imageUrl && item.type !== "artist")
    .slice(0, 6)
  if (art.length < 3) return null
  return (
    <ul aria-hidden className="grid grid-cols-3 gap-2 md:gap-3">
      {art.map((item, index) => (
        <li
          key={item.id}
          className={cn(
            "relative aspect-square overflow-hidden rounded-xl shadow-pop md:rounded-2xl",
            index % 2 === 1 && "translate-y-3 md:translate-y-5",
          )}
        >
          <MediaImage src={item.imageUrl ?? ""} alt="" sizes="160px" />
        </li>
      ))}
    </ul>
  )
}

/** Right-rail list of the top tracks (desktop). */
export async function TopTracks({ profile }: { profile: NicheProfile }) {
  const feed = await getNicheFeed(profile)
  const tracks = (feed.bySource.spotify ?? []).filter((item) => item.type === "track").slice(0, 5)
  if (tracks.length === 0) return null
  return (
    <section>
      <p className="mb-3 text-overline font-medium text-muted-foreground uppercase">Top tracks</p>
      <ol className="space-y-3">
        {tracks.map((track, index) => (
          <li key={track.id}>
            <a
              href={track.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3"
            >
              <span className="w-4 text-footnote text-subtle tabular-nums">{index + 1}</span>
              <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                {track.imageUrl ? <MediaImage src={track.imageUrl} alt="" sizes="44px" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-callout font-medium group-hover:underline">
                  {track.title}
                </span>
                <span className="block truncate text-footnote text-muted-foreground">
                  {track.subtitle}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Shimmer skeletons, never spinners. */
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className={cn("rounded-2xl", i % 2 ? "aspect-video" : "aspect-square")} />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}
