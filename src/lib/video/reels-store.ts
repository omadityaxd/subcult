"use client"

import { useSyncExternalStore } from "react"
import type { FeedItem } from "@/lib/feed/types"

/**
 * The full-screen video viewer is mounted once (tabs layout). Video cards
 * register as they mount; opening the viewer collects them in on-page order,
 * so swiping walks the same videos you were scrolling past.
 */
interface Registered {
  item: FeedItem
  element: Element
}

export interface ReelsState {
  items: readonly FeedItem[]
  index: number
}

const registry = new Map<string, Registered>()
const listeners = new Set<() => void>()
let state: ReelsState | null = null

const emit = (next: ReelsState | null) => {
  state = next
  listeners.forEach((listener) => listener())
}

export function registerVideo(item: FeedItem, element: Element): () => void {
  registry.set(item.id, { item, element })
  return () => {
    if (registry.get(item.id)?.element === element) registry.delete(item.id)
  }
}

function inPageOrder(): FeedItem[] {
  return [...registry.values()]
    .sort((a, b) =>
      a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    )
    .map(({ item }) => item)
}

/** Opens the viewer at `item`, with every video on the page around it. */
export function openReels(item: FeedItem): void {
  const items = inPageOrder()
  const index = items.findIndex((candidate) => candidate.id === item.id)
  emit(index >= 0 ? { items, index } : { items: [item], index: 0 })
}

export function closeReels(): void {
  emit(null)
}

export function useReels(): ReelsState | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
    () => null,
  )
}
