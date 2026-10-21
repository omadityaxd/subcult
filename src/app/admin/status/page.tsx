import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { costCaps, serviceStatus } from "@/lib/doctor/server"
import type { ServiceRow } from "@/lib/doctor/services"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "status" }

/** /admin/status: `pnpm run doctor` on production (behind ADMIN_SECRET, like all of /admin). */
export default function StatusPage() {
  return (
    <>
      <h1 className="font-display text-[34px] font-bold tracking-tight">status</h1>
      <p className="mt-1 text-[15px] text-muted-foreground">
        Every service: key present, reachable, quota left, and whether its features are on. Add a
        key in Vercel and redeploy to switch one on.
      </p>
      <Suspense fallback={<Skeleton className="mt-6 h-96 rounded-2xl" />}>
        <StatusTable />
      </Suspense>
    </>
  )
}

const STATE: Record<"on" | "error" | "off", { label: string; className: string }> = {
  on: { label: "on", className: "bg-foreground text-background" },
  error: { label: "error", className: "bg-destructive text-white" },
  off: { label: "off", className: "border border-border-strong text-muted-foreground" },
}

const stateOf = (row: ServiceRow) => (row.on ? "on" : row.present ? "error" : "off")

async function StatusTable() {
  await connection()
  const [rows, caps] = await Promise.all([serviceStatus(), costCaps()])
  const on = rows.filter((row) => row.on).length
  return (
    <div className="mt-6">
      <p className="mb-3 text-[13px] tracking-wide text-muted-foreground uppercase">
        {on}/{rows.length} on · checked {new Date().toISOString().slice(11, 19)} UTC
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card">
        {rows.map((row) => {
          const state = STATE[stateOf(row)]
          return (
            <li key={row.id} className="grid gap-1 px-4 py-3 md:grid-cols-[6rem_14rem_1fr_12rem]">
              <span
                className={cn(
                  "h-6 w-fit rounded-full px-2.5 text-[12px] leading-6 font-semibold uppercase",
                  state.className,
                )}
              >
                {state.label}
              </span>
              <span className="text-[15px] font-medium">
                {row.label}
                {row.required ? <span className="text-muted-foreground"> · required</span> : null}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {row.present ? row.detail : `missing ${row.missing.join(", ")}`}
                <span className="block">{row.unlocks}</span>
              </span>
              <span className="text-[13px] tabular-nums md:text-right">{row.quota ?? ""}</span>
            </li>
          )
        })}
      </ul>
      <h2 className="mt-10 mb-2 text-[13px] tracking-wide text-muted-foreground uppercase">
        cost caps: every paid or quota-limited call has one
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card">
        {caps.map((cap) => (
          <li key={cap.what} className="grid gap-1 px-4 py-3 md:grid-cols-[12rem_1fr_16rem]">
            <span className="text-[15px] font-medium">{cap.service}</span>
            <span className="text-[13px] text-muted-foreground">
              {cap.what}
              <span className="block text-foreground">{cap.cap}</span>
            </span>
            <span className="text-[13px] tabular-nums md:text-right">{cap.left ?? ""}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
