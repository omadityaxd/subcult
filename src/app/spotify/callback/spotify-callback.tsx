"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { finishSpotifyLogin } from "@/lib/spotify-connect/session"

// The code is single-use: share one exchange across React's dev double-effect.
let exchange: Promise<string> | null = null

export function SpotifyCallback() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    exchange ??= finishSpotifyLogin(new URLSearchParams(window.location.search))
    exchange
      .then((returnTo) => {
        if (!cancelled) router.replace(returnTo)
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Something went wrong.")
      })
    return () => {
      cancelled = true
    }
  }, [router])

  if (!error) return <p className="text-callout text-muted-foreground">Connecting Spotify…</p>
  return (
    <div className="space-y-4">
      <p className="font-serif text-title-2 italic">Spotify didn&apos;t connect</p>
      <p className="text-callout text-muted-foreground">{error}</p>
      <Link
        href="/me"
        className="inline-flex h-10 items-center rounded-full bg-foreground px-5 text-callout font-semibold text-background"
      >
        Back to Me
      </Link>
    </div>
  )
}
