"use client"

import { useEffect } from "react"
import { getAudioEngine } from "@/lib/audio/use-audio"
import type { ApiResponse } from "@/lib/request"
import { SAVED_EVENT } from "@/lib/saves"
import {
  type LabeledEntity,
  entityRef,
  humanize,
  labeledArtistsFromCredit,
} from "@/lib/taste/entities"
import { type ListenSession, accumulateListen, listenSignal } from "@/lib/taste/listens"
import type { Signal } from "@/lib/taste/model"
import { markSynced, recordSignal, resetLocalTaste, unsyncedSignals } from "@/lib/taste/store"

/** Cards register what they're about, so a save from any button can be learned from. */
const registry = new Map<string, LabeledEntity[]>()
export function registerItemEntities(id: string, entities: LabeledEntity[]): void {
  registry.set(id, entities)
}

const SYNC_MS = 20_000
const BATCH = 500

/** Credit → labeled artist entities, plus the niche the track was queued from. */
function listenEntities(session: ListenSession): LabeledEntity[] {
  const artists = labeledArtistsFromCredit(session.artist)
  const niche = session.niche ? entityRef("niche", session.niche) : null
  return niche ? [...artists, { ref: niche, label: humanize(niche) }] : artists
}

async function pushAndPull(): Promise<void> {
  const { signals, upTo } = unsyncedSignals()
  for (let i = 0; i < signals.length; i += BATCH) {
    const response = await fetch("/api/taste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signals: signals.slice(i, i + BATCH) }),
    })
    if (!response.ok) return
  }
  const response = await fetch("/api/taste")
  if (!response.ok) return
  const body = (await response.json()) as ApiResponse<{ signals: Signal[] }>
  markSynced(upTo, body.success ? body.data.signals : [])
}

/**
 * Asks the account to forget too (guests get a 401, nothing stored there),
 * then this device. False when the account copy couldn't be cleared.
 */
export async function resetTaste(): Promise<boolean> {
  const response = await fetch("/api/taste", { method: "DELETE" }).catch(() => null)
  if (!response || (!response.ok && response.status !== 401 && response.status !== 503)) {
    return false
  }
  resetLocalTaste()
  return true
}

/**
 * Mounted once (tabs layout): turns listening and saves into taste signals,
 * and for signed-in users merges this device's signals with the account's.
 */
export function TasteTracker({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    let session: ListenSession | null = null
    const finish = (done: ListenSession | null) => {
      if (done) recordSignal(listenSignal(done.seconds), listenEntities(done))
    }
    const off = getAudioEngine().onListen((track, seconds) => {
      const next = accumulateListen(session, {
        trackId: track.id,
        artist: track.artist,
        niche: track.niche ?? null,
        seconds,
      })
      session = next.current
      finish(next.finished)
    })

    const onSaved = (event: Event) => {
      const detail = (
        event as CustomEvent<{ id: string; source: string; title: string; saved: boolean }>
      ).detail
      if (!detail?.saved) return
      if (detail.source === "niche") {
        const ref = entityRef("niche", detail.id.replace(/^niche:/, ""))
        if (ref) recordSignal("follow", [{ ref, label: detail.title }])
        return
      }
      const entities = registry.get(detail.id)
      if (entities) recordSignal("save", entities, { itemId: detail.id })
    }
    window.addEventListener(SAVED_EVENT, onSaved)
    const onHide = () => {
      if (document.visibilityState !== "hidden") return
      finish(session)
      session = null
    }
    document.addEventListener("visibilitychange", onHide)
    return () => {
      off()
      finish(session)
      window.removeEventListener(SAVED_EVENT, onSaved)
      document.removeEventListener("visibilitychange", onHide)
    }
  }, [])

  useEffect(() => {
    if (!signedIn) return
    const sync = () => void pushAndPull().catch(() => undefined)
    sync()
    const timer = setInterval(sync, SYNC_MS)
    const onHide = () => {
      if (document.visibilityState === "hidden") sync()
    }
    document.addEventListener("visibilitychange", onHide)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onHide)
    }
  }, [signedIn])

  return null
}
