"use client"

import { Bell } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import type { ApiResponse } from "@/lib/request"
import { cn } from "@/lib/utils"
import { maybeSignedIn } from "@/lib/supabase/session-hint"

/** Fired by the center after marking everything read, so every bell clears. */
export const NOTIFICATIONS_READ_EVENT = "subcult:notifications-read"

async function fetchUnread(): Promise<number> {
  // Guests have no notifications: don't ask (it can only answer 401).
  if (!maybeSignedIn()) return 0
  const response = await fetch("/api/notifications")
  if (!response.ok) return 0
  const body = (await response.json()) as ApiResponse<{ unread: number }>
  return body.success ? body.data.unread : 0
}

/**
 * The bell: links to the notification center, with the unread count. This
 * is how alerts reach people who haven't turned on push.
 */
export function NotificationBell({
  className,
  withLabel = false,
  labelClassName,
}: {
  className?: string
  withLabel?: boolean
  labelClassName?: string
}) {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let alive = true
    const refresh = () =>
      void fetchUnread()
        .then((n) => alive && setUnread(n))
        .catch(() => undefined)
    refresh()
    const onVisible = () => document.visibilityState === "visible" && refresh()
    const onRead = () => setUnread(0)
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener(NOTIFICATIONS_READ_EVENT, onRead)
    return () => {
      alive = false
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener(NOTIFICATIONS_READ_EVENT, onRead)
    }
  }, [])

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      className={cn("relative flex items-center gap-4", className)}
    >
      <span className="relative">
        <Bell aria-hidden className="size-6 shrink-0" strokeWidth={1.5} />
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] leading-none font-bold text-accent-foreground tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </span>
      {withLabel ? <span className={cn("text-body", labelClassName)}>Notifications</span> : null}
    </Link>
  )
}
