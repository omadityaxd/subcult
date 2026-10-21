import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getDb } from "@/db"
import { moderationQueue } from "@/db/fit-repository"
import { AUTO_HIDE_REPORTS, TRUSTED_REPORTER_MIN_AGE_DAYS } from "@/lib/fits/schema"
import { moderationImageUrl } from "@/lib/fits/server"
import { cn } from "@/lib/utils"
import { setFitStatusAction } from "./actions"

export const metadata: Metadata = { title: "fits" }

export default function AdminFitsPage() {
  return (
    <>
      <h1 className="font-display text-[34px] font-bold tracking-tight">fits</h1>
      <p className="mt-1 text-[15px] text-muted-foreground">
        Every reported fit lands here. It&apos;s hidden automatically only after {AUTO_HIDE_REPORTS}{" "}
        reports from different accounts older than {TRUSTED_REPORTER_MIN_AGE_DAYS} days that have
        posted or voted; restore it if the reports were wrong.
      </p>
      <Suspense fallback={<Skeleton className="mt-6 h-96 rounded-2xl" />}>
        <Queue />
      </Suspense>
    </>
  )
}

async function Queue() {
  await connection()
  const db = getDb()
  if (!db)
    return <p className="mt-6 rounded-2xl bg-card p-4 text-muted-foreground">No database yet.</p>
  const queue = await moderationQueue(db)
  const fits = await Promise.all(
    queue.map(async (fit) => ({
      ...fit,
      preview: await moderationImageUrl(fit.imagePath, fit.status === "hidden"),
    })),
  )
  if (fits.length === 0) {
    return <p className="mt-6 rounded-2xl bg-card p-4 text-muted-foreground">Nothing reported.</p>
  }
  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {fits.map((fit) => (
        <li key={fit.id} className="overflow-hidden rounded-2xl bg-card">
          {fit.preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin review thumbnail
            <img src={fit.preview} alt="" className="aspect-[4/5] w-full object-cover" />
          ) : (
            <div className="aspect-[4/5] w-full bg-muted" />
          )}
          <div className="space-y-2 p-4 text-[14px]">
            <p className="font-semibold">@{fit.handle}</p>
            {fit.caption ? <p className="text-muted-foreground">{fit.caption}</p> : null}
            <p className="text-muted-foreground">
              {fit.reportCount} reports ·{" "}
              <span className={cn(fit.status === "hidden" && "text-destructive")}>
                {fit.status}
              </span>
            </p>
            <form action={setFitStatusAction}>
              <input type="hidden" name="id" value={fit.id} />
              <input
                type="hidden"
                name="status"
                value={fit.status === "hidden" ? "visible" : "hidden"}
              />
              <button
                type="submit"
                className="h-9 rounded-full border border-border px-4 font-medium hover:bg-muted"
              >
                {fit.status === "hidden" ? "Restore" : "Hide"}
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  )
}
