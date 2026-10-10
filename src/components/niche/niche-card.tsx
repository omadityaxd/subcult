import Image from "next/image"
import Link from "next/link"
import { Cover } from "@/components/ds/cover"
import { cn } from "@/lib/utils"

export interface NicheCardData {
  slug: string
  name: string
  tagline: string
  palette: readonly string[]
  /** Top artist photo; the generative cover shows beneath it (and instead of it). */
  imageUrl?: string | null
}

interface NicheCardProps {
  niche: NicheCardData
  /** "portrait" for grids, "wide" for horizontal rails. */
  shape?: "portrait" | "wide"
  isNew?: boolean
  className?: string
}

/**
 * Editorial niche card: generative cover with the name set in serif, tagline
 * beneath. The cover carries a shared-element name so it morphs into the
 * niche page hero on navigation.
 */
export function NicheCard({ niche, shape = "portrait", isNew, className }: NicheCardProps) {
  return (
    <Link
      href={`/n/${niche.slug}`}
      transitionTypes={["nav-forward"]}
      className={cn("group block outline-none", className)}
    >
      <Cover
        palette={niche.palette}
        seed={niche.slug}
        transitionName={`cover-${niche.slug}`}
        className={cn(
          "relative rounded-2xl shadow-card transition-[transform,box-shadow] duration-300 ease-out group-hover:-translate-y-0.5 group-hover:shadow-pop group-focus-visible:ring-2 group-focus-visible:ring-ring group-active:scale-[0.98]",
          shape === "portrait" ? "aspect-[4/5]" : "aspect-[16/10]",
        )}
      >
        {niche.imageUrl ? (
          <Image
            src={niche.imageUrl}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw"
            className="rounded-2xl object-cover saturate-[0.9]"
          />
        ) : null}
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-black/45 to-transparent",
            niche.imageUrl ? "h-2/3 from-black/70" : "h-1/2",
          )}
        />
        {isNew ? (
          <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-overline font-semibold text-black uppercase">
            New
          </span>
        ) : null}
        <span className="absolute inset-x-4 bottom-3.5 font-serif text-title-2 leading-none text-white italic drop-shadow-sm">
          {niche.name}
        </span>
      </Cover>
      <span className="mt-2.5 line-clamp-2 block text-footnote text-muted-foreground">
        {niche.tagline}
      </span>
    </Link>
  )
}
