"use client"

import { MoreHorizontal } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { ResponsiveSheet } from "@/components/ds/responsive-sheet"
import { Button } from "@/components/ds/button"
import type { ApiResponse } from "@/lib/request"
import { cn } from "@/lib/utils"

async function send(path: string, method: "POST" | "DELETE", handle: string) {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle }),
  })
  const body = (await response.json().catch(() => null)) as ApiResponse<unknown> | null
  return { status: response.status, body }
}

/** Follow / Following. Guests go to sign-in; people without a handle pick one on Me. */
export function FollowButton({
  handle,
  following: initial,
  signedIn,
}: {
  handle: string
  following: boolean
  signedIn: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [following, setFollowing] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = async () => {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`)
      return
    }
    setBusy(true)
    setError(null)
    const { status, body } = await send("/api/follows", following ? "DELETE" : "POST", handle)
    setBusy(false)
    if (status === 409) {
      router.push("/me#friends")
      return
    }
    if (!body?.success) {
      setError(body && !body.success ? body.error : "Try again")
      return
    }
    setFollowing(!following)
    router.refresh()
  }

  return (
    <span className="flex flex-col items-end">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={following}
        className={cn(
          "h-10 rounded-full px-5 text-footnote font-semibold disabled:opacity-60",
          following ? "border border-border-strong" : "bg-foreground text-background",
        )}
      >
        {following ? "Following" : "Follow"}
      </button>
      {error ? <span className="mt-1 text-caption text-destructive">{error}</span> : null}
    </span>
  )
}

/** Block or report-adjacent actions for someone else's profile. */
export function ProfileMenu({ handle }: { handle: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`More for @${handle}`}
        className="grid size-10 place-items-center rounded-full border border-border-strong"
      >
        <MoreHorizontal aria-hidden className="size-4" />
      </button>
      {open ? (
        <ResponsiveSheet
          open
          onOpenChange={(next) => (next ? undefined : setOpen(false))}
          title={`@${handle}`}
          description="Blocking unfollows you both and hides you from each other. They aren't told."
        >
          <Button
            variant="secondary"
            className="w-full text-destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await send("/api/blocks", "POST", handle)
              router.push("/")
            }}
          >
            Block @{handle}
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </ResponsiveSheet>
      ) : null}
    </>
  )
}
