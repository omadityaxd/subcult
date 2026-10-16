"use client"

import { Check, Link2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { HandleForm } from "@/app/(tabs)/fits/new/handle-form"
import { SectionHeader } from "@/components/ds/section-header"
import type { ApiResponse } from "@/lib/request"
import { cn } from "@/lib/utils"

interface Settings {
  handle: string
  visibility: "public" | "friends"
  shareListening: boolean
  following: string[]
  followers: string[]
  blocked: string[]
}

type State =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "needs-handle" }
  | { kind: "ready"; settings: Settings }

async function call(path: string, method: "POST" | "PUT" | "DELETE", body: unknown) {
  await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => undefined)
}

/** Me → Friends: invite link, privacy, opt-in listening, and who you follow / who follows you. */
export function FriendsSection() {
  const [state, setState] = useState<State>({ kind: "loading" })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/profile/settings")
      .then(async (response) => {
        if (cancelled) return
        if (response.status === 401 || response.status === 503) return setState({ kind: "guest" })
        if (response.status === 409) return setState({ kind: "needs-handle" })
        const body = (await response.json()) as ApiResponse<Settings>
        if (!cancelled && body.success) setState({ kind: "ready", settings: body.data })
      })
      .catch(() => !cancelled && setState({ kind: "guest" }))
    return () => {
      cancelled = true
    }
  }, [])

  if (state.kind === "loading") return null
  if (state.kind === "guest") {
    return (
      <section id="friends">
        <SectionHeader title="Friends" />
        <p className="text-callout text-muted-foreground">
          <Link href="/login?next=/me" className="font-semibold text-foreground underline">
            Sign in
          </Link>{" "}
          to follow friends and see your vibe match.
        </p>
      </section>
    )
  }
  if (state.kind === "needs-handle") {
    return (
      <section id="friends" className="scroll-mt-20">
        <SectionHeader title="Friends" />
        <HandleForm intro="Pick a handle so friends can find you." />
      </section>
    )
  }

  const { settings } = state
  const set = (patch: Partial<Settings>) =>
    setState({ kind: "ready", settings: { ...settings, ...patch } })
  const invite =
    typeof window === "undefined" ? "" : `${window.location.origin}/u/${settings.handle}`

  return (
    <section id="friends" className="scroll-mt-20">
      <SectionHeader overline={`@${settings.handle}`} title="Friends" />
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3">
          <div className="min-w-0">
            <p className="text-body">Invite friends</p>
            <p className="truncate text-footnote text-muted-foreground">
              {invite.replace(/^https?:\/\//, "")}
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              const text = "Find your vibe match with me on subcult"
              if (navigator.share) {
                await navigator.share({ url: invite, text }).catch(() => undefined)
                return
              }
              await navigator.clipboard.writeText(invite).catch(() => undefined)
              setCopied(true)
              setTimeout(() => setCopied(false), 1800)
            }}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 text-footnote font-semibold text-background"
          >
            {copied ? (
              <Check aria-hidden className="size-4" />
            ) : (
              <Link2 aria-hidden className="size-4" />
            )}
            {copied ? "Copied" : "Share link"}
          </button>
        </div>

        <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card">
          <li className="flex items-center justify-between gap-4 px-4 py-3">
            <label htmlFor="friends-only" className="min-w-0">
              <span className="block text-body">Friends-only profile</span>
              <span className="block text-footnote text-muted-foreground">
                Only people you follow back see your fits and taste
              </span>
            </label>
            <input
              id="friends-only"
              type="checkbox"
              role="switch"
              checked={settings.visibility === "friends"}
              onChange={(e) => {
                const visibility = e.target.checked ? "friends" : "public"
                set({ visibility })
                void call("/api/profile/settings", "PUT", { visibility })
              }}
              className="size-5 shrink-0 accent-foreground"
            />
          </li>
          <li className="flex items-center justify-between gap-4 px-4 py-3">
            <label htmlFor="share-listening" className="min-w-0">
              <span className="block text-body">Show what I&apos;m playing</span>
              <span className="block text-footnote text-muted-foreground">
                On your profile, for 20 minutes after you play something
              </span>
            </label>
            <input
              id="share-listening"
              type="checkbox"
              role="switch"
              checked={settings.shareListening}
              onChange={(e) => {
                set({ shareListening: e.target.checked })
                void call("/api/profile/settings", "PUT", { shareListening: e.target.checked })
              }}
              className="size-5 shrink-0 accent-foreground"
            />
          </li>
        </ul>

        <People
          title="Following"
          people={settings.following}
          empty="Open a friend's link or profile and follow them."
          action={{
            label: "Unfollow",
            run: (handle) => {
              set({ following: settings.following.filter((h) => h !== handle) })
              void call("/api/follows", "DELETE", { handle })
            },
          }}
        />
        <People
          title="Followers"
          people={settings.followers}
          empty="Share your link: friends who follow you show up here."
          action={{
            label: "Remove",
            run: (handle) => {
              set({ followers: settings.followers.filter((h) => h !== handle) })
              void call("/api/followers", "DELETE", { handle })
            },
          }}
          secondary={{
            label: "Block",
            run: (handle) => {
              set({
                followers: settings.followers.filter((h) => h !== handle),
                following: settings.following.filter((h) => h !== handle),
                blocked: [...settings.blocked, handle],
              })
              void call("/api/blocks", "POST", { handle })
            },
          }}
        />
        {settings.blocked.length > 0 ? (
          <People
            title="Blocked"
            people={settings.blocked}
            empty=""
            linkless
            action={{
              label: "Unblock",
              run: (handle) => {
                set({ blocked: settings.blocked.filter((h) => h !== handle) })
                void call("/api/blocks", "DELETE", { handle })
              },
            }}
          />
        ) : null}
      </div>
    </section>
  )
}

function People({
  title,
  people,
  empty,
  action,
  secondary,
  linkless = false,
}: {
  title: string
  people: string[]
  empty: string
  action: { label: string; run: (handle: string) => void }
  secondary?: { label: string; run: (handle: string) => void }
  linkless?: boolean
}) {
  return (
    <div className="rounded-2xl bg-card px-4 py-3">
      <p className="text-body">
        {title} <span className="text-muted-foreground tabular-nums">{people.length}</span>
      </p>
      {people.length === 0 ? (
        <p className="text-footnote text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1 divide-y divide-border">
          {people.map((handle) => (
            <li key={handle} className="flex items-center justify-between gap-3 py-2">
              {linkless ? (
                <span className="truncate text-callout">@{handle}</span>
              ) : (
                <Link href={`/u/${handle}`} className="truncate text-callout font-semibold">
                  @{handle}
                </Link>
              )}
              <span className="flex shrink-0 gap-1">
                {secondary ? (
                  <button
                    type="button"
                    onClick={() => secondary.run(handle)}
                    className="h-8 rounded-full px-3 text-footnote text-destructive hover:bg-muted"
                  >
                    {secondary.label}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => action.run(handle)}
                  className={cn(
                    "h-8 rounded-full border border-border-strong px-3 text-footnote font-semibold",
                  )}
                >
                  {action.label}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
