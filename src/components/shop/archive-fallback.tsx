import { ArrowUpRight } from "lucide-react"
import { resaleSearches } from "@/lib/links"

const MAX_BRANDS = 6

/**
 * The Archive tab before live listings exist (or when none are up): the
 * niche's brands, each with a search on eBay, Grailed and Depop. Useful,
 * never a blank area, and no word about keys or services.
 */
export function ArchiveFallback({
  nicheName,
  brands,
  reason,
}: {
  nicheName: string
  brands: readonly string[]
  /** "soon": live listings aren't switched on yet; "quiet": on, but nothing listed now. */
  reason: "soon" | "quiet"
}) {
  const shown = brands.slice(0, MAX_BRANDS)
  return (
    <section data-testid="archive-fallback" className="rounded-3xl border border-border p-5 md:p-8">
      <p className="text-caption font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        {reason === "soon" ? "Coming soon" : "Nothing listed right now"}
      </p>
      <h3 className="mt-2 font-serif text-title-2 italic">The {nicheName} archive</h3>
      <p className="mt-2 max-w-lg text-callout text-muted-foreground">
        {reason === "soon"
          ? "Live listings by brand and era are on the way. Until then, hunt the scene's brands secondhand:"
          : "No live listings for these brands at the moment. Hunt them secondhand:"}
      </p>
      {shown.length > 0 ? (
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {shown.map((brand) => (
            <li key={brand} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <span className="basis-full text-callout font-semibold sm:min-w-0 sm:flex-1 sm:basis-auto">
                {brand}
              </span>
              <span className="flex gap-2">
                {resaleSearches(brand).map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Search ${link.label} for ${brand}`}
                    className="inline-flex h-9 items-center gap-1 rounded-full border border-border-strong px-3 text-footnote font-medium transition-colors hover:bg-muted"
                  >
                    {link.label}
                    <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.75} />
                  </a>
                ))}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
