import { connection } from "next/server"
import { NicheCard } from "@/components/niche/niche-card"
import { Skeleton } from "@/components/ui/skeleton"
import { getDb } from "@/db"
import { type TrendingCard, listActiveTrending } from "@/db/trend-repository"
import { withTimeout } from "@/lib/concurrency"
import { errorMessage, log } from "@/lib/log"
import { isNew } from "@/lib/niches/lifecycle"

const TIMEOUT_MS = 2_000

/** "Trending now": active trends from the trend engine. Renders nothing if there are none. */
export async function TrendingRow() {
  await connection()
  const db = getDb()
  if (!db) return null

  const now = new Date()
  let cards: TrendingCard[]
  try {
    cards = await withTimeout(listActiveTrending(db, now), TIMEOUT_MS, "trending row")
  } catch (error) {
    log.warn("explore.trending.unavailable", { error: errorMessage(error) })
    return null
  }
  if (cards.length === 0) return null

  return (
    <section aria-labelledby="trending-now" className="container-page mb-8">
      <h2 id="trending-now" className="mb-4 font-serif text-title-2 italic">
        Trending now
      </h2>
      <ul className="-mx-(--gutter) no-scrollbar flex snap-x gap-3 overflow-x-auto px-(--gutter) pb-1 md:gap-5">
        {cards.map((card) => (
          <li key={card.slug} className="w-[72vw] max-w-80 shrink-0 snap-start">
            <NicheCard niche={card} shape="wide" isNew={isNew(card.publishedAt, now)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export function TrendingRowSkeleton() {
  return (
    <div aria-hidden className="container-page mb-8 flex gap-3 overflow-hidden">
      <Skeleton className="aspect-[16/10] w-[72vw] max-w-80 shrink-0 rounded-2xl" />
      <Skeleton className="aspect-[16/10] w-[72vw] max-w-80 shrink-0 rounded-2xl" />
    </div>
  )
}
