"use client"

import { Bell, Disc3, Flame, Gem, Users } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { MediaImage } from "@/components/ds/media-image"
import { Skeleton } from "@/components/ui/skeleton"
import type { AlertType } from "@/lib/alerts/policy"
import type { ApiResponse } from "@/lib/request"
import { formatAge } from "@/lib/time"
import { NOTIFICATIONS_READ_EVENT } from "./notification-bell"

interface Item {
  id: number
  type: AlertType
  title: string
  body: string | null
  url: string
  imageUrl: string | null
  createdAt: string
  read: boolean
}

const ICON: Record<AlertType, typeof Bell> = {
  drop: Disc3,
  grail: Gem,
  niche: Flame,
  friend: Users,
}

type State = { state: "loading" } | { state: "failed" } | { state: "ready"; items: Item[] }

/** The in-app center: works without push, and opening it marks everything read. */
export function NotificationCenter({ signedIn }: { signedIn: boolean }) {
  const [load, setLoad] = useState<State>(
    signedIn ? { state: "loading" } : { state: "ready", items: [] },
  )

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    fetch("/api/notifications")
      .then((r) => r.json() as Promise<ApiResponse<{ items: Item[] }>>)
      .then((body) => {
        if (cancelled) return
        setLoad(body.success ? { state: "ready", items: body.data.items } : { state: "failed" })
        if (body.success && body.data.items.some((i) => !i.read)) {
          void fetch("/api/notifications", { method: "POST" }).then(() =>
            window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT)),
          )
        }
      })
      .catch(() => !cancelled && setLoad({ state: "failed" }))
    return () => {
      cancelled = true
    }
  }, [signedIn])

  if (!signedIn) {
    return (
      <Empty
        title="Alerts live on your account"
        body="Sign in to hunt grails under a price, hear about drops from artists you play, and know when your scene blows up."
        action={{ href: "/login?next=/notifications", label: "Sign in" }}
      />
    )
  }
  if (load.state === "loading") {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    )
  }
  if (load.state === "failed") {
    return (
      <Empty
        title="Couldn't load notifications"
        body="Check your connection and pull to refresh."
      />
    )
  }
  if (load.items.length === 0) {
    return (
      <Empty
        title="Nothing yet"
        body="Hunt a grail from any listing (“Alert me for similar”), play some artists, follow a few niches. Alerts land here."
        action={{ href: "/me#alerts", label: "Alert settings" }}
      />
    )
  }
  const now = new Date()
  return (
    <ul className="divide-y divide-border">
      {load.items.map((item) => {
        const Icon = ICON[item.type]
        const external = item.url.startsWith("https://")
        const body = (
          <>
            <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
              {item.imageUrl ? (
                <MediaImage src={item.imageUrl} alt="" sizes="48px" />
              ) : (
                <Icon aria-hidden className="size-5" strokeWidth={1.75} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-callout font-semibold">{item.title}</span>
              {item.body ? (
                <span className="line-clamp-2 block text-footnote text-muted-foreground">
                  {item.body}
                </span>
              ) : null}
              <span className="mt-0.5 block text-caption text-subtle">
                {formatAge(item.createdAt, now)}
              </span>
            </span>
            {item.read ? null : (
              <span aria-label="Unread" className="size-2 shrink-0 rounded-full bg-accent" />
            )}
          </>
        )
        return (
          <li key={item.id}>
            {external ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 py-3"
              >
                {body}
              </a>
            ) : (
              <Link href={item.url} className="flex items-center gap-3 py-3">
                {body}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Empty({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: { href: string; label: string }
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong p-8 text-center">
      <Bell aria-hidden className="mx-auto size-6 text-subtle" strokeWidth={1.5} />
      <p className="mt-3 font-serif text-title-3 italic">{title}</p>
      <p className="mt-2 text-callout text-muted-foreground">{body}</p>
      {action ? (
        <Link
          href={action.href}
          className="mt-4 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-footnote font-semibold text-background"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}
