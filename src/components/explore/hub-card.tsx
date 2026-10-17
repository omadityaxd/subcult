import { ArrowRight } from "lucide-react"
import { CdnImage } from "@/components/ds/cdn-image"
import Link from "next/link"
import { Cover } from "@/components/ds/cover"
import { TAXONOMY, findPreset } from "@/lib/niches/catalog"
import { hubSections } from "@/lib/taxonomy/hubs"
import { cn } from "@/lib/utils"

export interface HubSummary {
  slug: string
  name: string
  description: string
  branches: string[]
  nicheCount: number
  palette: readonly string[]
  images: string[]
}

/** Everything a hub card or hub hero needs, derived from the graph. */
export function hubSummary(slug: string): HubSummary | null {
  const hub = TAXONOMY.hubs.find((h) => h.slug === slug)
  if (!hub) return null
  const sections = hubSections(TAXONOMY, slug)
  const niches = sections.flatMap((section) => section.niches)
  const presets = niches.flatMap((niche) => {
    const preset = findPreset(niche)
    return preset ? [preset] : []
  })
  return {
    slug,
    name: hub.name,
    description: hub.description,
    branches: sections.length > 1 ? sections.map((section) => section.name) : [],
    nicheCount: niches.length,
    // The lead niche's palette dresses the hub.
    palette: presets[0]?.palette ?? ["#0a0a0a", "#1a1a1a", "#444444", "#aaaaaa", "#f2f2f2"],
    images: presets.flatMap((preset) => (preset.imageUrl ? [preset.imageUrl] : [])),
  }
}

/** Collage of artist photos fanned across a hub cover. */
export function HubCollage({
  images,
  className,
  small,
}: {
  images: readonly string[]
  className?: string
  small?: boolean
}) {
  return (
    <span aria-hidden className={cn("flex -space-x-4", className)}>
      {images.slice(0, 4).map((src, index) => (
        <span
          key={src}
          className={cn(
            "relative overflow-hidden rounded-full border-2 border-black/40 shadow-pop",
            small ? "size-12" : "size-16 md:size-20",
          )}
          style={{ zIndex: 4 - index }}
        >
          <CdnImage src={src} alt="" fill sizes="80px" className="object-cover" />
        </span>
      ))}
    </span>
  )
}

/** Editorial entry card to a hub page (top of Explore). */
export function HubCard({ hub, size = "lg" }: { hub: HubSummary; size?: "lg" | "md" }) {
  return (
    <Link href={`/explore/${hub.slug}`} transitionTypes={["nav-forward"]} className="group block">
      <Cover
        palette={hub.palette}
        seed={`hub-${hub.slug}`}
        className={cn(
          "relative flex flex-col rounded-3xl text-white transition-transform duration-300 group-active:scale-[0.99]",
          size === "lg" ? "min-h-72 p-6 md:min-h-80 md:p-10" : "min-h-52 p-6",
        )}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-3xl bg-gradient-to-t from-black/70 via-black/20 to-black/10"
        />
        {/* In flow (not absolute) so the photos can never sit on top of the title. */}
        <HubCollage images={hub.images} small={size === "md"} className="relative self-end" />
        <span className="relative mt-auto pt-6 text-overline font-medium text-white/70 uppercase">
          Hub · {hub.nicheCount} niches
        </span>
        <span
          className={cn(
            "relative mt-2 max-w-xl font-serif text-balance italic",
            size === "lg" ? "text-title-1" : "text-title-2",
          )}
        >
          {hub.name}
        </span>
        {hub.branches.length > 0 ? (
          <span className="relative mt-3 text-callout text-white/80">
            {hub.branches.join(" · ")}
          </span>
        ) : (
          <span className="relative mt-2 max-w-md text-callout text-white/80">
            {hub.description}
          </span>
        )}
        <span className="relative mt-5 inline-flex items-center gap-1.5 text-callout font-semibold">
          Browse the hub
          <ArrowRight
            aria-hidden
            className="size-4 transition-transform group-hover:translate-x-0.5"
            strokeWidth={1.75}
          />
        </span>
      </Cover>
    </Link>
  )
}
