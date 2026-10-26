"use client"

import dynamic from "next/dynamic"
import { useReels } from "@/lib/video/reels-store"
import { preloadWhenIdle } from "@/lib/ui/when-idle"

// Opens on a tap: the viewer's code loads when the page is idle, not with the first paint.
const loadReelsViewer = () => import("./reels-viewer").then((m) => m.ReelsViewer)
const ReelsViewer = dynamic(loadReelsViewer, { ssr: false })
preloadWhenIdle(loadReelsViewer)

/** Mounts the full-screen video viewer while Reels are open. */
export function ReelsHost() {
  const reels = useReels()
  return reels ? <ReelsViewer key={`${reels.items[0]?.id}:${reels.index}`} reels={reels} /> : null
}
