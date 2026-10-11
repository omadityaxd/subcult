"use client"

import { useEffect, useSyncExternalStore } from "react"
import { getAudioEngine } from "@/lib/audio/use-audio"
import {
  type ListenEvent,
  type WrappedData,
  emptyWrapped,
  recordListen,
  recordVisit,
  wrappedDataSchema,
} from "./stats"

const STORAGE_KEY = "subcult-wrapped-v1"
const FLUSH_MS = 15_000

let data: WrappedData | null = null
let dirty = false
const listeners = new Set<() => void>()

function load(): WrappedData {
  if (data) return data
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? wrappedDataSchema.safeParse(JSON.parse(raw)) : null
    data = parsed?.success ? parsed.data : emptyWrapped(Date.now())
  } catch {
    data = emptyWrapped(Date.now())
  }
  return data
}

function flush(): void {
  if (!dirty || !data) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    dirty = false
  } catch {
    // Storage full or blocked: keep the in-memory copy for this visit.
  }
  listeners.forEach((listener) => listener())
}

function update(next: WrappedData, { immediate = false } = {}): void {
  if (next === data) return
  data = next
  dirty = true
  if (immediate) flush()
}

export function trackListen(event: ListenEvent, seconds: number): void {
  update(recordListen(load(), event, seconds, Date.now()))
}

export function trackVisit(slug: string): void {
  update(recordVisit(load(), slug, Date.now()), { immediate: true })
}

export function useWrappedData(): WrappedData | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    load,
    () => null,
  )
}

/** Mount once (tabs layout): turns heard audio into Wrapped stats, flushed every 15s and on exit. */
export function useWrappedTracker(): void {
  useEffect(() => {
    const off = getAudioEngine().onListen((track, seconds) =>
      trackListen(
        {
          trackId: track.id,
          title: track.title,
          artist: track.artist,
          artworkUrl: track.artworkUrl ?? null,
          niche: track.niche ?? null,
        },
        seconds,
      ),
    )
    const timer = setInterval(flush, FLUSH_MS)
    const onHide = () => {
      if (document.visibilityState === "hidden") flush()
    }
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", flush)
    return () => {
      off()
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", flush)
      flush()
    }
  }, [])
}
