"use client"

import { useSyncExternalStore } from "react"
import type { TodayEdition } from "./edition"

/** What today's issue already showed: the feed below it never repeats these. */
export interface IssueShown {
  ids: ReadonlySet<string>
  images: readonly string[]
}

const EMPTY: IssueShown = { ids: new Set(), images: [] }
let snapshot: IssueShown = EMPTY
const listeners = new Set<() => void>()

/** Called by the issue once it renders an edition. */
export function publishIssueShown(edition: TodayEdition): void {
  const items = [
    edition.cover.item,
    ...edition.sections.flatMap((section) => section.items),
    edition.copOrDrop ?? null,
  ].filter((item) => item !== null)
  const art = edition.cover.art
  const artImages = !art ? [] : art.kind === "portrait" ? [art.imageUrl] : art.images
  snapshot = {
    ids: new Set(items.map((item) => item.id)),
    images: [...items.flatMap((item) => (item.imageUrl ? [item.imageUrl] : [])), ...artImages],
  }
  for (const listener of listeners) listener()
}

export function useIssueShown(): IssueShown {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => snapshot,
    () => EMPTY,
  )
}
