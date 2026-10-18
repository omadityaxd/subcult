import Link from "next/link"
import { connection } from "next/server"
import { FitGrid } from "@/components/fits/fit-tile"
import { PinCard } from "@/components/moodboard/pin-card"
import { fitFeedItems, nicheFits } from "@/lib/fits/server"
import { postingEnabled } from "@/lib/supabase/admin"
import { getViewer } from "@/lib/supabase/server"
import { cache } from "react"
import { ExternalChips } from "@/components/ds/external-chips"
import { ArchiveBoard } from "@/components/shop/archive-board"
import { ProductCard } from "@/components/shop/product-card"
import { archiveFeedItems, getArchive } from "@/lib/shop/server"
import { moodboardFeedItems } from "@/lib/moodboard/board"
import { getMoodboard } from "@/lib/moodboard/server"
import { MediaImage } from "@/components/ds/media-image"
import { freshness } from "@/lib/time"
import { SectionHeader } from "@/components/ds/section-header"
import { Skeleton } from "@/components/ui/skeleton"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { type NicheFeed, buildNicheFeed } from "@/lib/feed/feed"
import { appFeedDeps } from "@/lib/feed/app-deps"
import type { FeedItem } from "@/lib/feed/types"
import { googleNews, spotify, youtube } from "@/lib/links"
import { TAXONOMY, findPreset } from "@/lib/niches/catalog"
import { buildForYou, withVideoNiches } from "@/lib/feed/for-you"
import { tagFeedItems } from "@/lib/taxonomy/tagging"
import { cn } from "@/lib/utils"
import { LinkList } from "../link-card"
import { NicheAutoplay } from "@/components/music/niche-autoplay"
import { type ShelfNiche, SoundtrackShelf } from "@/components/music/soundtrack-shelf"
import { PlayableList, SoundtrackHeader, TrackList } from "@/components/music/track-list"
import type { PlayableTrack } from "@/lib/music/playable"
import { soundtrackFeedItems } from "@/lib/music/soundtrack"
import { getSoundtrack } from "@/lib/music/soundtrack-server"
import { ArtistsRow } from "../artists-row"
import { SoundsSection } from "../sections/sounds-section"
import { FeedCard } from "./feed-card"
import { ProgressiveList } from "./progressive-list"
import { TaggedFeed } from "./tagged-feed"

const SHELF_SIZE = 8

/** One feed build per request, shared by every tab, the hero and the rail. */
export const getNicheFeed = cache(async (profile: NicheProfile): Promise<NicheFeed> => {
  await connection()
  return buildNicheFeed(profile, appFeedDeps())
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

/** The ranked feed, with the niche's tag chips (only those that match something) as filters. */
export async function LiveForYou({ profile }: { profile: NicheProfile }) {
  const [feed, soundtrack, board, archives, fits] = await Promise.all([
    getNicheFeed(profile),
    getSoundtrack(profile.slug),
    getMoodboard(profile.slug),
    getArchive(profile.slug),
    nicheFits(profile.slug, 12),
  ])
  // Every kind of content, interleaved to the niche's target mix.
  const items = buildForYou(profile.slug, feed, {
    music: soundtrack ? soundtrackFeedItems(soundtrack) : [],
    moodboard: moodboardFeedItems(board.pins),
    // People's fits lead the fashion share, then live archive pieces.
    fashion: [...fitFeedItems(fits), ...archiveFeedItems(archives ?? [])],
  })
  if (items.length === 0) return null
  const tagged = tagFeedItems(items, TAXONOMY.tagsOf(profile.slug))
  return (
    <section className="mt-10">
      <SectionHeader overline="Ranked for you" title="Latest" />
      <TaggedFeed items={tagged.items} tags={tagged.tags} now={feed.generatedAt} />
    </section>
  )
}

/**
 * Sounds tab: "This is <niche>" soundtrack (playable here), the verified
 * artists (tap for the artist sheet), then neighbouring niches' soundtracks:
 * our own playlists, built from verified artists.
 */
export async function LiveSounds({ profile }: { profile: NicheProfile }) {
  const soundtrack = await getSoundtrack(profile.slug)
  const artists = TAXONOMY.artistsOf(profile.slug).map(({ slug, name, imageUrl }) => ({
    slug,
    name,
    imageUrl,
  }))
  if (!soundtrack || soundtrack.tracks.length === 0) return <SoundsSection profile={profile} />
  const shelf = soundtrackShelf(profile.slug)

  return (
    <div className="space-y-12 pt-2">
      <section className="space-y-6">
        <SoundtrackHeader soundtrack={soundtrack} />
        <TrackList soundtrack={soundtrack} />
      </section>
      <ArtistsRow artists={artists} />
      {shelf.length > 0 ? (
        <section>
          <SectionHeader title="More soundtracks" />
          <SoundtrackShelf niches={shelf} />
        </section>
      ) : null}
      <ExternalChips
        label="Search Spotify"
        links={profile.spotifyQueries.map((query) => ({
          title: query,
          href: spotify.playlistSearch(query),
          site: "Spotify",
        }))}
      />
    </div>
  )
}

/** Neighbouring niches (then two-hop picks) whose soundtracks open as in-app playlists. */
function soundtrackShelf(slug: string): ShelfNiche[] {
  const picks = [
    ...TAXONOMY.adjacent(slug).map(({ slug: target, label }) => ({ target, label: String(label) })),
    ...TAXONOMY.recommend(slug).map((target) => ({ target, label: "Two hops away" })),
  ]
  const seen = new Set<string>()
  return picks
    .flatMap(({ target, label }) => {
      const preset = findPreset(target)
      if (!preset || seen.has(target)) return []
      seen.add(target)
      return [{ slug: target, name: preset.name, imageUrl: preset.imageUrl, label }]
    })
    .slice(0, SHELF_SIZE)
}

export async function NicheSoundtrack({ slug }: { slug: string }) {
  const soundtrack = await getSoundtrack(slug)
  return soundtrack && soundtrack.tracks.length > 0 ? (
    <NicheAutoplay soundtrack={soundtrack} />
  ) : null
}

export async function LiveTea({ profile }: { profile: NicheProfile }) {
  const feed = await getNicheFeed(profile)
  const items = feed.bySource.news ?? []
  const now = new Date(feed.generatedAt)
  const today = items.filter((item) => freshness(item.publishedAt, now) === "today")
  const week = items.filter((item) => freshness(item.publishedAt, now) !== "today")
  return (
    <div className="space-y-12">
      {today.length > 0 ? (
        <section>
          <SectionHeader overline="The tea" title="Today" />
          <Masonry items={today} now={feed.generatedAt} className="sm:columns-2 xl:columns-2" />
        </section>
      ) : null}
      {week.length > 0 ? (
        <section>
          <SectionHeader overline={today.length > 0 ? undefined : "The tea"} title="This week" />
          <Masonry items={week} now={feed.generatedAt} className="sm:columns-2 xl:columns-2" />
        </section>
      ) : null}
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-strong p-8 text-center text-callout text-muted-foreground">
          Quiet week: no fresh headlines about this scene yet.
        </p>
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
  const items = withVideoNiches(feed.bySource.youtube ?? [], profile.slug)
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
  const albumArt = (feed.bySource.spotify ?? [])
    .filter((item) => item.imageUrl && item.type !== "artist")
    .map((item) => ({ id: item.id, imageUrl: item.imageUrl as string }))
  // Spotify down or rate-limited: the verified artist photos still make a mosaic.
  const photos = TAXONOMY.artistsOf(profile.slug).flatMap((artist) =>
    artist.imageUrl ? [{ id: artist.slug, imageUrl: artist.imageUrl }] : [],
  )
  const art = (albumArt.length >= 3 ? albumArt : photos).slice(0, 6)
  if (art.length < 3) return null
  return (
    <ul aria-hidden className="grid grid-cols-3 gap-x-2 gap-y-5 md:gap-x-3 md:gap-y-8">
      {art.map((item, index) => (
        <li
          key={item.id}
          className={cn(
            "relative aspect-square overflow-hidden rounded-xl shadow-pop md:rounded-2xl",
            // Stagger the middle column; the row gap leaves room so tiles never touch.
            index % 3 === 1 && "translate-y-3 md:translate-y-5",
          )}
        >
          <MediaImage src={item.imageUrl} alt="" sizes="160px" />
        </li>
      ))}
    </ul>
  )
}

/** Right-rail list of the top tracks (desktop): playable here, queue = the list. */
export async function TopTracks({ profile }: { profile: NicheProfile }) {
  const feed = await getNicheFeed(profile)
  const tracks = (feed.bySource.spotify ?? [])
    .filter((item) => item.type === "track")
    .slice(0, 5)
    .map((item): PlayableTrack => ({
      id: item.id,
      title: item.title,
      artist: item.subtitle ?? "",
      artworkUrl: item.imageUrl,
      spotifyUrl: item.url,
      niche: profile.slug,
    }))
  if (tracks.length === 0) return null
  return (
    <section>
      <p className="mb-2 text-overline font-medium text-muted-foreground uppercase">Top tracks</p>
      <PlayableList tracks={tracks} context={`Top tracks · ${profile.name}`} />
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

/** Archive tab: live eBay listings for the niche's brands, by brand and era. */
export async function LiveArchive({ profile }: { profile: NicheProfile }) {
  await connection()
  const archives = await getArchive(profile.slug)
  if (archives === null || archives.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-strong p-8 text-center">
        <p className="font-serif text-title-3 italic">The archive is offline right now</p>
        <p className="mt-2 text-callout text-muted-foreground">
          {archives === null
            ? "Live eBay listings for these brands will show up here."
            : "No live listings for these brands at the moment. Check back soon."}
        </p>
      </div>
    )
  }
  return <ArchiveBoard archives={archives} />
}

const FITS_GRAILS = 8

/** Top grails across the niche's brands: a strip on the Fits tab. */
export async function ArchiveGrails({ profile }: { profile: NicheProfile }) {
  await connection()
  const archives = await getArchive(profile.slug)
  const items = archiveFeedItems(archives ?? []).slice(0, FITS_GRAILS)
  if (items.length === 0) return null
  return (
    <section>
      <SectionHeader overline="Live on eBay" title="From the archive" />
      <ul className="-mx-(--gutter) no-scrollbar flex gap-3 overflow-x-auto px-(--gutter) pb-1">
        {items.map((item) => (
          <li key={item.id} className="w-40 shrink-0 sm:w-48">
            <ProductCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  )
}

const LOOKS_UNTIL = 6
const LOOKS = 12

/** Fits tab: people's fits for this niche, with the way in to posting one. */
export async function LiveFits({ profile }: { profile: NicheProfile }) {
  await connection()
  const [fits, viewer, board] = await Promise.all([
    nicheFits(profile.slug),
    getViewer(),
    getMoodboard(profile.slug),
  ])
  // Until the community fills the tab, real looks keep it visual: images
  // vision-verified as outfits (including "seen on <artist>"), never press photos.
  const looks =
    fits.length < LOOKS_UNTIL
      ? moodboardFeedItems(board.pins)
          // Only images vision-tagged as outfits: never artist press photos.
          .filter((item) => item.meta.fit === true)
          .slice(0, LOOKS)
      : []
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <SectionHeader overline="From the community" title="Fits" />
        {postingEnabled() ? (
          <Link
            href="/fits/new"
            className="mb-1 inline-flex h-10 shrink-0 items-center rounded-full bg-foreground px-4 text-footnote font-semibold text-background"
          >
            Post your fit
          </Link>
        ) : null}
      </div>
      {fits.length > 0 ? (
        <FitGrid fits={fits} signedIn={viewer !== null} />
      ) : (
        <div className="rounded-2xl border border-dashed border-border-strong p-8 text-center">
          <p className="font-serif text-title-3 italic">No {profile.name} fits yet</p>
          <p className="mt-2 text-callout text-muted-foreground">
            Be the first: the founding 50 get a badge.
          </p>
          <Link
            href="/fits/new"
            className="mt-4 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-footnote font-semibold text-background"
          >
            Post your first fit
          </Link>
        </div>
      )}
      {looks.length > 0 ? (
        <div className="mt-10">
          <SectionHeader overline="Visual references" title="Looks from the scene" />
          <ul className="columns-2 gap-3 sm:columns-3">
            {looks.map((item) => (
              <li key={item.id} className="mb-3 break-inside-avoid">
                <PinCard item={item} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
