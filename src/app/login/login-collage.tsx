import { connection } from "next/server"
import { Cover } from "@/components/ds/cover"
import { MediaImage } from "@/components/ds/media-image"
import { focusOf } from "@/lib/images/curate"
import { errorMessage, log } from "@/lib/log"
import { TAXONOMY, findPreset, nicheLeadArtist } from "@/lib/niches/catalog"
import { type CollageTile, collageTiles } from "@/lib/today/collage"
import type { TodayEdition } from "@/lib/today/edition"
import { buildToday } from "@/lib/today/server"

const FALLBACK_PALETTE = ["#0b0a10", "#1d1b2a", "#4b4470", "#c9b8ff", "#f5f2ff"]
/** Scenes whose faces and covers the collage can use. */
const SCENES = 4

function Tile({ tile }: { tile: CollageTile }) {
  return (
    <figure className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-white/10">
      {tile.kind === "niche" ? (
        <Cover palette={tile.palette} seed={tile.seed} className="absolute inset-0" />
      ) : (
        <MediaImage
          src={tile.imageUrl}
          alt=""
          sizes="(max-width: 768px) 50vw, 25vw"
          focus={tile.focus ?? undefined}
        />
      )}
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-8 text-white">
        <span className="block text-overline font-semibold tracking-[0.15em] uppercase opacity-80">
          {tile.caption}
        </span>
        {tile.detail ? (
          <span className="block truncate text-footnote font-medium">{tile.detail}</span>
        ) : null}
      </figcaption>
    </figure>
  )
}

/**
 * The login's left side: today's cover (only when it's sharp enough to be
 * one), the best fit and an artist portrait from today's scenes, or the
 * scenes' generative covers when too few images qualify.
 */
export async function LoginCollage() {
  await connection()
  let edition: TodayEdition | null = null
  try {
    edition = await buildToday({ entities: [], brands: [], lastVisit: null, timeZone: "UTC" })
  } catch (error) {
    log.warn("login.collage_failed", { error: errorMessage(error) })
  }
  const cover = edition?.cover
  const scenes = TAXONOMY.featured()
    .slice(0, SCENES)
    .flatMap((slug) => {
      const preset = findPreset(slug)
      return preset ? [preset] : []
    })
  const tiles = collageTiles({
    fits: edition?.sections.find((s) => s.id === "fit")?.items ?? [],
    portraits: scenes.flatMap((scene) => {
      const lead = nicheLeadArtist(scene.slug)
      return lead?.imageUrl ? [{ name: lead.name, imageUrl: lead.imageUrl, niche: scene.name }] : []
    }),
    coverUrl: cover?.item?.imageUrl ?? null,
    niches: scenes,
  })

  return (
    <Cover
      palette={cover?.palette ?? scenes[0]?.palette ?? FALLBACK_PALETTE}
      seed="login"
      className="relative flex h-full min-h-[26rem] flex-col justify-between p-5 text-white md:p-10"
    >
      {cover?.item?.imageUrl ? (
        <>
          <MediaImage
            src={cover.item.imageUrl}
            alt=""
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
            focus={focusOf(cover.item)}
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/80"
          />
        </>
      ) : null}
      <div className="relative">
        <p className="font-serif text-[44px] leading-none italic md:text-[72px]">subcult</p>
        <p className="mt-2 text-callout font-medium text-white/85">Your daily subculture issue.</p>
      </div>
      <div className="relative">
        {cover?.headline ? (
          <p className="mb-4 max-w-md font-serif text-title-2 leading-tight text-balance italic md:text-title-1">
            {cover.headline}
          </p>
        ) : null}
        <div className="grid max-w-md grid-cols-2 gap-2">
          {tiles.map((tile) => (
            <Tile key={"imageUrl" in tile ? tile.imageUrl : tile.seed} tile={tile} />
          ))}
        </div>
      </div>
    </Cover>
  )
}
