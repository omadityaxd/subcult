"use client"

import { useMemo, useSyncExternalStore } from "react"
import { z } from "zod"
import type { FeedItem } from "@/lib/feed/types"
import { TASTE_COOKIE, encodeTasteCookie, writeCookie } from "@/lib/today/cookies"
import { type LabeledEntity, entityType, labeledEntitiesOfItem } from "./entities"
import {
  type Signal,
  type SignalKind,
  type TasteVector,
  computeAffinity,
  signalSchema,
} from "./model"

/**
 * Taste signals on this device. Guests keep them here only; signed-in users
 * also sync them to their account (TasteSync), so the two merge on sign-in.
 * Every storage access is guarded: blocked storage just means no memory.
 */
const STORAGE_KEY = "subcult-taste-v1"
const MAX_SIGNALS = 3000
const MAX_SEEN = 600
/** Past ~4 half-lives a signal weighs under 1/16: drop it. */
const KEEP_MS = 60 * 24 * 3600_000
/** A card's niche learns half as much as the card's own artist/brand. */
const NICHE_SPILLOVER = 0.5

const stateSchema = z.object({
  signals: z.array(signalSchema),
  seen: z.array(z.string()).default([]),
  /** Newest signal time already sent to the server. */
  syncedAt: z.number().default(0),
})
type TasteState = { signals: Signal[]; seen: string[]; syncedAt: number }

const EMPTY: TasteState = { signals: [], seen: [], syncedAt: 0 }
let state: TasteState | null = null
const listeners = new Set<() => void>()

function load(): TasteState {
  if (state) return state
  if (typeof window === "undefined") return EMPTY
  try {
    const parsed = stateSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"))
    state = parsed.success ? (parsed.data as TasteState) : EMPTY
  } catch {
    state = EMPTY
  }
  return state
}

function save(next: TasteState): void {
  const now = Date.now()
  state = {
    ...next,
    signals: next.signals.filter((s) => now - s.at < KEEP_MS).slice(-MAX_SIGNALS),
    seen: next.seen.slice(-MAX_SEEN),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or blocked: the in-memory copy still personalizes this visit.
  }
  syncTasteCookie(state.signals)
  listeners.forEach((listener) => listener())
}

/** Called once on mount (the tracker): existing signals reach the cookie before the next save. */
export function syncTasteCookieNow(): void {
  syncTasteCookie(load().signals)
}

/** Mirrors the strongest entities into a small cookie so Today can render on the server. */
function syncTasteCookie(signals: readonly Signal[]): void {
  const vector = computeAffinity(signals, Date.now())
  writeCookie(
    TASTE_COOKIE,
    encodeTasteCookie([...vector.values()].map((a) => ({ ref: a.entity, score: a.score }))),
  )
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    state = null
    listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

/**
 * One signal per entity. When a card names something specific (an artist,
 * a brand), its niche gets a half-strength echo of the same signal.
 */
export function signalsFor(
  kind: SignalKind,
  entities: readonly LabeledEntity[],
  at: number,
  strength = 1,
): Signal[] {
  const specific = entities.some(({ ref }) => entityType(ref) !== "niche")
  return entities.map(({ ref, label }) => ({
    kind,
    entity: ref,
    label,
    at,
    strength: specific && entityType(ref) === "niche" ? strength * NICHE_SPILLOVER : strength,
  }))
}

export function recordSignal(
  kind: SignalKind,
  entities: readonly LabeledEntity[],
  { strength = 1, itemId }: { strength?: number; itemId?: string } = {},
): void {
  if (entities.length === 0) return
  const current = load()
  const seen =
    itemId && (kind === "open" || kind === "save" || kind === "play_through")
      ? [...current.seen.filter((id) => id !== itemId), itemId]
      : current.seen
  save({
    ...current,
    signals: [...current.signals, ...signalsFor(kind, entities, Date.now(), strength)],
    seen,
  })
}

/** Convenience: a signal about a feed card shown in a niche's page. */
export function recordItemSignal(
  kind: SignalKind,
  item: FeedItem,
  niche: { slug: string; name: string } | null = null,
): void {
  recordSignal(kind, labeledEntitiesOfItem(item, niche), { itemId: item.id })
}

/** The vibe check seeds taste: each niche in the result, weighted by its share. */
export function recordVibeCheck(
  mix: readonly { slug: string; name: string; percent: number }[],
): void {
  const at = Date.now()
  const signals = mix.flatMap((niche) =>
    signalsFor(
      "vibe_check",
      [{ ref: `niche:${niche.slug}`, label: niche.name }],
      at,
      niche.percent / 100,
    ),
  )
  if (signals.length === 0) return
  const current = load()
  save({ ...current, signals: [...current.signals, ...signals] })
}

/** "Reset taste": forget everything on this device (TasteSync clears the account copy). */
export function resetLocalTaste(): void {
  save(EMPTY)
}

export function useTasteSignals(): readonly Signal[] {
  return useSyncExternalStore(
    subscribe,
    () => load().signals,
    () => EMPTY.signals,
  )
}

export function useSeen(): ReadonlySet<string> {
  const seen = useSyncExternalStore(
    subscribe,
    () => load().seen,
    () => EMPTY.seen,
  )
  return useMemo(() => new Set(seen), [seen])
}

const EMPTY_VECTOR: TasteVector = new Map()
let vectorCache: { signals: readonly Signal[]; vector: TasteVector } | null = null

/** Taste from storage, recomputed only when signals change (a few thousand at most). */
export function readTasteVector(): TasteVector {
  if (typeof window === "undefined") return EMPTY_VECTOR
  const signals = load().signals
  if (vectorCache?.signals !== signals) {
    vectorCache = { signals, vector: computeAffinity(signals, Date.now()) }
  }
  return vectorCache.vector
}

/** The person's taste right now. */
export function useTasteVector(): TasteVector {
  return useSyncExternalStore(subscribe, readTasteVector, () => EMPTY_VECTOR)
}

// --- Account sync -----------------------------------------------------------

const keyOf = (s: Signal) => `${s.kind}|${s.entity}|${s.at}`

/** Union by (kind, entity, time): the same event on both sides counts once. */
export function mergeSignals(local: readonly Signal[], remote: readonly Signal[]): Signal[] {
  const byKey = new Map(local.map((s) => [keyOf(s), s]))
  for (const s of remote) if (!byKey.has(keyOf(s))) byKey.set(keyOf(s), s)
  return [...byKey.values()].sort((a, b) => a.at - b.at)
}

export function unsyncedSignals(): { signals: Signal[]; upTo: number } {
  const current = load()
  const signals = current.signals.filter((s) => s.at > current.syncedAt)
  return { signals, upTo: Math.max(current.syncedAt, ...signals.map((s) => s.at)) }
}

export function markSynced(upTo: number, remote: readonly Signal[] = []): void {
  const current = load()
  save({
    ...current,
    signals: mergeSignals(current.signals, remote),
    syncedAt: Math.max(current.syncedAt, upTo),
  })
}
