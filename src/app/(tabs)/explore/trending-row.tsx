import Link from "next/link"
import { connection } from "next/server"
import { Skeleton } from "@/components/ui/skeleton"
import { getDb } from "@/db"
import { type TrendingCard, listActiveTrending } from "@/db/trend-repository"
import { withTimeout } from "@/lib/concurrency"
import { readableTextColor } from "@/lib/color"
import { errorMessage, log } from "@/lib/log"
import { isNew } from "@/lib/niches/lifecycle"

const TIMEOUT_MS = 2_000

/** "🔥 trending now": active trends from the trend engine. Renders nothing if there are none. */
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
    <section aria-labelledby="trending-now" className="mb-6">
      <h2 id="trending-now" className="mb-3 px-4 text-[20px] font-semibold tracking-tight">
        🔥 trending now
      </h2>
      <ul className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
        {cards.map((card) => {
          const [, c2, c3] = card.palette
          const ink = readableTextColor(c2)
          return (
            <li key={card.slug} className="w-56 shrink-0">
              <Link
                href={`/n/${card.slug}`}
                transitionTypes={["nav-forward"]}
                className="relative flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-2xl p-4 transition-transform active:scale-[0.97]"
                style={{ backgroundImage: `linear-gradient(150deg, ${c2}, ${c3})`, color: ink }}
              >
                <span className="flex items-start justify-between">
                  <span aria-hidden className="text-3xl">
                    {card.emoji}
                  </span>
                  {isNew(card.publishedAt, now) ? (
                    <span className="rounded-full bg-black/80 px-2 py-0.5 text-[12px] font-semibold text-white">
                      🔥 new
                    </span>
                  ) : null}
                </span>
                <span>
                  <span className="font-display block text-[18px] leading-tight font-bold">
                    {card.name}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[13px] opacity-85">
                    {card.tagline}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function TrendingRowSkeleton() {
  return (
    <div aria-hidden className="mb-6 flex gap-3 overflow-hidden px-4">
      <Skeleton className="aspect-[4/3] w-56 shrink-0 rounded-2xl" />
      <Skeleton className="aspect-[4/3] w-56 shrink-0 rounded-2xl" />
    </div>
  )
}
