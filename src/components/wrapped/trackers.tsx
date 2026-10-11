"use client"

import { useEffect } from "react"
import { trackVisit, useWrappedTracker } from "@/lib/wrapped/store"

/** Records listening for Wrapped (mounted once in the tabs layout). */
export function WrappedTracker() {
  useWrappedTracker()
  return null
}

/** Records a niche visit (and first discovery) when its page opens. */
export function NicheVisit({ slug }: { slug: string }) {
  useEffect(() => trackVisit(slug), [slug])
  return null
}
