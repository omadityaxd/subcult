import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getDb } from "@/db"
import { type ManagedNiche, listManagedNiches } from "@/db/trend-repository"
import type { NicheStatus } from "@/lib/niches/lifecycle"
import { cn } from "@/lib/utils"
import { setNicheStatusAction } from "./actions"

export const metadata: Metadata = { title: "niches" }

export default function AdminNichesPage() {
  return (
    <>
      <h1 className="font-display text-[34px] font-bold tracking-tight">niches</h1>
      <p className="mt-1 text-[15px] text-muted-foreground">
        Trending and user-made niches. Hidden niches 404; archived ones stay reachable by URL. Seeds
        are managed in /data/niches.
      </p>
      <Suspense fallback={<Skeleton className="mt-6 h-96 rounded-2xl" />}>
        <NicheList />
      </Suspense>
    </>
  )
}

const STATUS_STYLE: Record<NicheStatus, string> = {
  active: "bg-accent/15 text-accent",
  archived: "bg-muted text-muted-foreground",
  hidden: "bg-destructive/15 text-destructive",
}

async function NicheList() {
  await connection()
  const db = getDb()
  if (!db) {
    return <p className="mt-6 rounded-2xl bg-card p-4 text-muted-foreground">No database yet.</p>
  }
  const niches = await listManagedNiches(db)
  if (niches.length === 0) {
    return (
      <p className="mt-6 rounded-2xl bg-card p-4 text-muted-foreground">
        No trending or user niches yet.
      </p>
    )
  }

  return (
    <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl bg-card">
      {niches.map((niche) => (
        <NicheRow key={niche.slug} niche={niche} />
      ))}
    </ul>
  )
}

function NicheRow({ niche }: { niche: ManagedNiche }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <Link href={`/n/${niche.slug}`} className="block truncate text-[15px] font-medium">
          {niche.name}
        </Link>
        <p className="text-[12px] text-muted-foreground">
          {niche.kind} · by {niche.generatedBy} · {niche.publishedAt.toISOString().slice(0, 10)}
          {niche.expiresAt ? ` → ${niche.expiresAt.toISOString().slice(0, 10)}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-[12px]", STATUS_STYLE[niche.status])}>
          {niche.status}
        </span>
        <form action={setNicheStatusAction}>
          <input type="hidden" name="slug" value={niche.slug} />
          <input
            type="hidden"
            name="status"
            value={niche.status === "hidden" ? "active" : "hidden"}
          />
          <button
            type="submit"
            className="rounded-full bg-muted px-3 py-1 text-[13px] font-medium active:scale-95"
          >
            {niche.status === "hidden" ? "restore" : "hide"}
          </button>
        </form>
      </div>
    </li>
  )
}
