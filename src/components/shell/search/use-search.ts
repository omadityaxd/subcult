"use client"

import { useEffect, useState } from "react"
import type { SearchResults } from "@/app/api/search/route"
import type { ApiResponse } from "@/lib/request"

const RECENT_KEY = "subcult-recent-searches-v1"
const MAX_RECENT = 6
const DEBOUNCE_MS = 200

export interface Trending {
  kind: "niche" | "artist" | "brand"
  slug: string
  label: string
  count: number
}

function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}

/** Remembers a search on this device (most recent first, no repeats). */
export function rememberSearch(text: string): string[] {
  const clean = text.trim()
  if (clean.length < 2) return readRecent()
  const next = [
    clean,
    ...readRecent().filter((t) => t.toLowerCase() !== clean.toLowerCase()),
  ].slice(0, MAX_RECENT)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Not remembered; the search still works.
  }
  return next
}

/** Counts a search that led to a known niche, artist or brand (feeds "trending"). */
export function logSearch(kind: Trending["kind"], slug: string): void {
  void fetch("/api/search/trending", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, slug }),
  }).catch(() => undefined)
}

/**
 * The palette's data: server results for the query (debounced, stale
 * requests cancelled), this device's recent searches and the week's
 * trending ones (fetched when the palette opens).
 */
export function useSearch(open: boolean, query: string) {
  const [results, setResults] = useState<{ q: string; data: SearchResults } | null>(null)
  const [loading, setLoading] = useState(false)
  const [trending, setTrending] = useState<Trending[]>([])
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    // Device storage and a network call: both only after the palette opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(readRecent())
    let cancelled = false
    fetch("/api/search/trending")
      .then((r) => r.json() as Promise<ApiResponse<{ trending: Trending[] }>>)
      .then((body) => {
        if (!cancelled && body.success) setTrending(body.data.trending)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [open])

  const q = query.trim()
  useEffect(() => {
    if (!open || q.length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => r.json() as Promise<ApiResponse<SearchResults>>)
        .then((body) => {
          if (body.success) setResults({ q, data: body.data })
        })
        .catch(() => undefined)
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [open, q])

  return {
    // Results for an older query never show under a newer one.
    results: results && results.q === q ? results.data : null,
    loading: q.length >= 2 && loading,
    trending,
    recent,
    remember: (text: string) => setRecent(rememberSearch(text)),
  }
}
