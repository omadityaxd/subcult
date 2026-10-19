"use client"

import { Trash2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { SectionHeader } from "@/components/ds/section-header"
import { type PushState, disablePush, enablePush, pushState } from "@/lib/alerts/client"
import type { ApiResponse } from "@/lib/request"
import { cn } from "@/lib/utils"
import { zoneLabel, zoneToSave } from "@/lib/alerts/zone"
import { maybeSignedIn } from "@/lib/supabase/session-hint"

interface Prefs {
  drops: boolean
  grails: boolean
  niches: boolean
  friends: boolean
  quietStart: number
  quietEnd: number
  timeZone: string
}

interface Grail {
  id: string
  brand: string
  item: string
  maxPrice: number
  size: string | null
}

const TOGGLES: { key: "drops" | "grails" | "niches" | "friends"; label: string; hint: string }[] = [
  { key: "drops", label: "Drops", hint: "New releases from artists you play" },
  { key: "grails", label: "Grails", hint: "New listings matching your hunts" },
  { key: "niches", label: "Your niche is blowing up", hint: "At most once a week" },
  { key: "friends", label: "Friends", hint: "Fits from people you follow, new vibe matches" },
]

const PUSH_LABEL: Record<PushState, string> = {
  unsupported: "This browser can't do push. Alerts still land under the bell.",
  "needs-install": "On iPhone: Share → Add to Home Screen, then turn on push from the app.",
  off: "Off: alerts wait under the bell.",
  on: "On for this device. One push a day at most.",
  blocked: "Blocked in your browser settings. Alerts still land under the bell.",
}

const hours = Array.from({ length: 24 }, (_, h) => h * 60)
const hourLabel = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`
}

async function put(patch: Partial<Prefs>) {
  await fetch("/api/alerts/prefs", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
}

/** Me → Alerts: push on this device, per-type toggles, quiet hours, grail hunts. */
export function AlertSettings({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [prefs, setPrefs] = useState<Prefs | null | "guest">(null)
  const [grails, setGrails] = useState<Grail[]>([])
  const [push, setPush] = useState<PushState>("unsupported")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const response = maybeSignedIn() ? await fetch("/api/alerts/prefs").catch(() => null) : null
      if (cancelled) return
      if (!response || response.status === 401 || response.status === 503) {
        setPrefs("guest")
        return
      }
      const body = (await response.json()) as ApiResponse<Prefs>
      if (body.success) {
        // Quiet hours are in the reader's own time: keep the saved zone in step with the device.
        const zone = zoneToSave(
          body.data.timeZone,
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        )
        setPrefs(zone ? { ...body.data, timeZone: zone } : body.data)
        if (zone) void put({ timeZone: zone })
      }
      const grailBody = (await fetch("/api/grails").then((r) => r.json())) as ApiResponse<{
        grails: Grail[]
      }>
      if (!cancelled && grailBody.success) setGrails(grailBody.data.grails)
      const state = await pushState()
      if (!cancelled) setPush(state)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (prefs === null) return null
  if (prefs === "guest") {
    return (
      <section id="alerts">
        <SectionHeader title="Alerts" />
        <p className="text-callout text-muted-foreground">
          <Link href="/login?next=/me" className="font-semibold text-foreground underline">
            Sign in
          </Link>{" "}
          to get drop and grail alerts.
        </p>
      </section>
    )
  }

  const update = (patch: Partial<Prefs>) => {
    setPrefs({ ...prefs, ...patch })
    void put(patch)
  }

  return (
    <section id="alerts" className="scroll-mt-20">
      <SectionHeader overline="One push a day, never at night" title="Alerts" />
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-card px-4 py-3">
          <div className="min-w-0">
            <p className="text-body">Push on this device</p>
            <p className="text-footnote text-muted-foreground">{PUSH_LABEL[push]}</p>
          </div>
          {vapidPublicKey && (push === "off" || push === "on") ? (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                const next =
                  push === "on"
                    ? await disablePush()
                    : await enablePush(vapidPublicKey).catch((): PushState => "off")
                setPush(next)
                setBusy(false)
              }}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-footnote font-semibold",
                push === "on" ? "border border-border-strong" : "bg-foreground text-background",
              )}
            >
              {push === "on" ? "Turn off" : "Turn on"}
            </button>
          ) : null}
        </div>

        <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card">
          {TOGGLES.map(({ key, label, hint }) => (
            <li key={key} className="flex items-center justify-between gap-4 px-4 py-3">
              <label htmlFor={`alert-${key}`} className="min-w-0">
                <span className="block text-body">{label}</span>
                <span className="block text-footnote text-muted-foreground">{hint}</span>
              </label>
              <input
                id={`alert-${key}`}
                type="checkbox"
                role="switch"
                checked={prefs[key]}
                onChange={(e) => update({ [key]: e.target.checked })}
                className="size-5 shrink-0 accent-foreground"
              />
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card px-4 py-3 text-body">
          <span>Quiet from</span>
          <select
            aria-label="Quiet hours start"
            value={prefs.quietStart}
            onChange={(e) => update({ quietStart: Number(e.target.value) })}
            className="rounded-lg border border-border-strong bg-transparent px-2 py-1"
          >
            {hours.map((m) => (
              <option key={m} value={m}>
                {hourLabel(m)}
              </option>
            ))}
          </select>
          <span>to</span>
          <select
            aria-label="Quiet hours end"
            value={prefs.quietEnd}
            onChange={(e) => update({ quietEnd: Number(e.target.value) })}
            className="rounded-lg border border-border-strong bg-transparent px-2 py-1"
          >
            {hours.map((m) => (
              <option key={m} value={m}>
                {hourLabel(m)}
              </option>
            ))}
          </select>
          <span className="text-footnote text-muted-foreground" title={prefs.timeZone}>
            {zoneLabel(prefs.timeZone)}
          </span>
        </div>

        <div className="rounded-2xl bg-card px-4 py-3">
          <p className="text-body">Grail hunts</p>
          {grails.length === 0 ? (
            <p className="text-footnote text-muted-foreground">
              None yet. Open any archive listing and tap &ldquo;Alert me for similar&rdquo;.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {grails.map((grail) => (
                <li key={grail.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-callout">
                    {grail.brand} {grail.item}
                    <span className="text-muted-foreground">
                      {" "}
                      · under ${grail.maxPrice}
                      {grail.size ? ` · size ${grail.size}` : ""}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Stop hunting ${grail.brand} ${grail.item}`}
                    onClick={async () => {
                      setGrails(grails.filter((g) => g.id !== grail.id))
                      await fetch(`/api/grails?id=${grail.id}`, { method: "DELETE" })
                    }}
                    className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                  >
                    <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
