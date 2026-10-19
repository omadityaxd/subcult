import { connection } from "next/server"
import { Cover } from "@/components/ds/cover"
import { MediaImage } from "@/components/ds/media-image"
import type { FeedItem } from "@/lib/feed/types"
import { youtubeCrop } from "@/lib/images/youtube-crop"
import { errorMessage, log } from "@/lib/log"
import { formatPrice } from "@/lib/shop/archive"
import type { TodayEdition } from "@/lib/today/edition"
import { buildToday } from "@/lib/today/server"

const FALLBACK_PALETTE = ["#0b0a10", "#1d1b2a", "#4b4470", "#c9b8ff", "#f5f2ff"]

function Tile({
  item,
  caption,
  detail,
  crop,
  className,
}: {
  item: FeedItem
  caption: string
  detail: string | null
  crop?: boolean
  className?: string
}) {
  return (
    <figure className={`relative overflow-hidden rounded-2xl bg-white/10 ${className ?? ""}`}>
      {item.imageUrl ? (
        <MediaImage
          src={item.imageUrl}
          alt=""
          sizes="(max-width: 768px) 50vw, 25vw"
          className={youtubeCrop(item.imageUrl, { short: crop, frame: "portrait" })}
        />
      ) : null}
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-8 text-white">
        <span className="block text-overline font-semibold tracking-[0.15em] uppercase opacity-80">
          {caption}
        </span>
        {detail ? <span className="block truncate text-footnote font-medium">{detail}</span> : null}
      </figcaption>
    </figure>
  )
}

/**
 * The login's left side: today's real cover, fit and grail (whatever a new
 * reader's issue leads with right now), under the masthead.
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
  const fit = edition?.sections.find((s) => s.id === "fit")?.items.find((i) => i.imageUrl)
  const grail = edition?.sections.find((s) => s.id === "grail")?.items.find((i) => i.imageUrl)
  const price = (item: FeedItem) =>
    typeof item.meta.price === "number"
      ? formatPrice(
          item.meta.price,
          typeof item.meta.currency === "string" ? item.meta.currency : "USD",
        )
      : null

  return (
    <Cover
      palette={cover?.palette ?? FALLBACK_PALETTE}
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
            className={youtubeCrop(cover.item.imageUrl, {
              short: cover.item.meta.short === true,
              frame: "portrait",
            })}
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
        {fit || grail ? (
          <div className="grid max-w-md grid-cols-2 gap-2">
            {fit ? (
              <Tile
                item={fit}
                caption="Fit of the day"
                detail={typeof fit.meta.nicheName === "string" ? fit.meta.nicheName : null}
                crop={fit.meta.short === true}
                className="aspect-[3/4]"
              />
            ) : null}
            {grail ? (
              <Tile
                item={grail}
                caption="Grail of the day"
                detail={[grail.subtitle, price(grail)].filter(Boolean).join(" · ") || null}
                className="aspect-[3/4]"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </Cover>
  )
}
