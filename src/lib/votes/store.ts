"use client"

import { useSyncExternalStore } from "react"
import type { VoteChoice } from "@/db/schema"
import type { FeedItem } from "@/lib/feed/types"
import type { ApiResponse } from "@/lib/request"
import { recordItemSignal } from "@/lib/taste/store"
import type { VoteTally } from "./split"

/** Your own votes on this device (target id → choice), so a card remembers what you said. */
const VOTES_KEY = "subcult-votes-v1"
const DEVICE_KEY = "subcult-device-v1"
const MAX_KEPT = 1000

type Mine = Readonly<Record<string, VoteChoice>>
const EMPTY: Mine = {}
let cache: Mine | null = null
const listeners = new Set<() => void>()

function read(): Mine {
  if (cache) return cache
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(VOTES_KEY) ?? "{}")
    cache = parsed && typeof parsed === "object" ? (parsed as Mine) : EMPTY
  } catch {
    cache = EMPTY
  }
  return cache
}

function remember(target: string, choice: VoteChoice): void {
  const entries = Object.entries({ ...read(), [target]: choice }).slice(-MAX_KEPT)
  cache = Object.fromEntries(entries)
  try {
    localStorage.setItem(VOTES_KEY, JSON.stringify(cache))
  } catch {
    // Storage blocked: the vote still counts server-side for this session.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useMyVote(target: string): VoteChoice | null {
  return useSyncExternalStore(
    subscribe,
    () => read()[target] ?? null,
    () => null,
  )
}

/** A random id for this device: how a guest's vote counts once. */
function deviceId(): string | undefined {
  try {
    const existing = localStorage.getItem(DEVICE_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
    return id
  } catch {
    return undefined
  }
}

/**
 * Casts a vote: remembered on the device, fed into taste (cop = like,
 * drop = skip; a poll pick likes the chosen look), then counted. Returns the
 * real tally, or null when it couldn't be counted.
 */
export async function castVote(
  target: string,
  choice: VoteChoice,
  item: FeedItem | null,
): Promise<VoteTally | null> {
  remember(target, choice)
  if (item) recordItemSignal(choice === "drop" ? "skip" : "like", item)
  try {
    const response = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, choice, device: deviceId() }),
    })
    const body = (await response.json()) as ApiResponse<{ tally: VoteTally }>
    return body.success ? body.data.tally : null
  } catch {
    return null
  }
}
