"use client"

import { useSyncExternalStore } from "react"

/**
 * Saved items, kept on this device until accounts land (Phase 6 syncs them
 * to the user's account). Optimistic by nature: the UI updates instantly.
 */
export interface SavedItem {
  id: string
  title: string
  url: string
  imageUrl: string | null
  source: string
  subtitle: string | null
  savedAt: number
}

const STORAGE_KEY = "subcult-saves-v1"
const MAX_SAVES = 500
const EMPTY: readonly SavedItem[] = []

export function toggleSave(
  items: readonly SavedItem[],
  item: Omit<SavedItem, "savedAt">,
  now: number,
): SavedItem[] {
  return items.some((saved) => saved.id === item.id)
    ? items.filter((saved) => saved.id !== item.id)
    : [{ ...item, savedAt: now }, ...items].slice(0, MAX_SAVES)
}

let cache: readonly SavedItem[] | null = null
const listeners = new Set<() => void>()

function read(): readonly SavedItem[] {
  if (cache) return cache
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
    cache = Array.isArray(parsed) ? (parsed as SavedItem[]) : EMPTY
  } catch {
    cache = EMPTY
  }
  return cache
}

function write(items: readonly SavedItem[]): void {
  cache = items
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Storage blocked/full: the in-memory copy still works for this session.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    cache = null
    listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

export function useSaves(): readonly SavedItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY)
}

export function useIsSaved(id: string): boolean {
  return useSaves().some((item) => item.id === id)
}

/** Fired on every save/unsave/follow change: { id, source, title, saved }. */
export const SAVED_EVENT = "subcult:saved"

function announce(item: Omit<SavedItem, "savedAt">, saved: boolean): void {
  window.dispatchEvent(
    new CustomEvent(SAVED_EVENT, {
      detail: { id: item.id, source: item.source, title: item.title, saved },
    }),
  )
}

export function toggleSaved(item: Omit<SavedItem, "savedAt">): void {
  const wasSaved = read().some((saved) => saved.id === item.id)
  write(toggleSave(read(), item, Date.now()))
  announce(item, !wasSaved)
}

export function setSaved(item: Omit<SavedItem, "savedAt">, saved: boolean): void {
  const current = read()
  const isSaved = current.some((existing) => existing.id === item.id)
  if (isSaved === saved) return
  write(toggleSave(current, item, Date.now()))
  announce(item, saved)
}
