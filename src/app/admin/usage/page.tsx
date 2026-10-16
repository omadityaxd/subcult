import type { Metadata } from "next"
import { connection } from "next/server"
import { type ReactNode, Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getDb } from "@/db"
import { type UsageTotals, summarizeUsage } from "@/db/usage-repository"
import { formatUsd } from "@/lib/engine/pricing"
import { startOfUtcDay } from "@/lib/engine/usage"
import { env } from "@/lib/env"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "usage" }

export default function UsagePage() {
  return (
    <>
      <h1 className="font-display text-[34px] font-bold tracking-tight">usage</h1>
      <p className="mt-1 text-[15px] text-muted-foreground">LLM spend, straight from llm_usage.</p>
      <Suspense fallback={<UsageSkeleton />}>
        <UsageReport />
      </Suspense>
    </>
  )
}

async function UsageReport() {
  await connection()
  const db = getDb()
  if (!db) return <Notice>DATABASE_URL isn&apos;t set, so there&apos;s no ledger yet.</Notice>

  const summary = await summarizeUsage(db, { startOfToday: startOfUtcDay() })

  return (
    <div className="mt-6 space-y-6">
      <CapCard
        label="daily generation cap"
        used={summary.generationsToday}
        cap={env.LLM_DAILY_GENERATION_CAP}
      />
      <CapCard
        label="daily vision cap (batches)"
        used={summary.visionBatchesToday}
        cap={env.VISION_DAILY_BATCH_CAP}
      />

      <section className="grid grid-cols-3 gap-3">
        <TotalsCard label="today" totals={summary.today} />
        <TotalsCard label="7 days" totals={summary.last7Days} />
        <TotalsCard label="all time" totals={summary.allTime} />
      </section>

      {summary.byPurpose.length > 0 ? (
        <section>
          <h2 className="mb-2 text-[13px] tracking-wide text-muted-foreground uppercase">
            by feature · 7 days
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card">
            {summary.byPurpose.map((row) => (
              <li key={row.purpose} className="flex items-center justify-between px-4 py-3">
                <p className="text-[15px] font-medium">{row.purpose}</p>
                <p className="text-[13px] text-muted-foreground tabular-nums">
                  {row.jobs} jobs ·{" "}
                  <span className="text-[15px] text-foreground">{formatUsd(row.costUsd)}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-[13px] tracking-wide text-muted-foreground uppercase">
          recent jobs
        </h2>
        {summary.recent.length === 0 ? (
          <Notice>Nothing yet. Zero dollars spent, a perfect run.</Notice>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card">
            {summary.recent.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">{row.subject}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {row.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {row.purpose} ·{" "}
                    {row.status}
                  </p>
                </div>
                <div className="shrink-0 text-right text-[12px] text-muted-foreground tabular-nums">
                  <p className="text-[15px] text-foreground">{formatUsd(row.costUsd)}</p>
                  <p>
                    {row.inputTokens.toLocaleString()} / {row.outputTokens.toLocaleString()} tok
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function CapCard({ label, used, cap }: { label: string; used: number; cap: number }) {
  const share = cap === 0 ? 1 : Math.min(1, used / cap)
  return (
    <section className="rounded-2xl bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold">{label}</h2>
        <span className="text-[15px] tabular-nums">
          {used} / {cap}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", share >= 1 ? "bg-destructive" : "bg-accent")}
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground">Resets at 00:00 UTC.</p>
    </section>
  )
}

function TotalsCard({ label, totals }: { label: string; totals: UsageTotals }) {
  return (
    <div className="rounded-2xl bg-card p-3">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[20px] font-semibold tabular-nums">{formatUsd(totals.costUsd)}</p>
      <p className="text-[12px] text-muted-foreground tabular-nums">
        {totals.jobs} jobs · {(totals.inputTokens + totals.outputTokens).toLocaleString()} tok
      </p>
    </div>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 rounded-2xl bg-card p-4 text-[15px] text-muted-foreground">{children}</p>
  )
}

function UsageSkeleton() {
  return (
    <div className="mt-6 space-y-6" aria-busy="true" aria-label="Loading usage">
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}
