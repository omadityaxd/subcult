"use client"

import { useEffect, useState } from "react"
import { getAudioEngine } from "@/lib/audio/use-audio"
import type { StoryMusic } from "@/lib/music/story-music"
import type { ApiResponse } from "@/lib/request"

/**
 * Background music for the open story: fetches the niche's preview, crossfades
 * to it when the niche changes, pauses while the story is held, and fades out
 * when the viewer closes. No match → the story plays silently.
 *
 * Returns undefined while loading, null for a silent story.
 */
export function useStoryMusic(slug: string, paused: boolean): StoryMusic | null | undefined {
  const [music, setMusic] = useState<Record<string, StoryMusic | null>>({})
  const current = music[slug]

  useEffect(() => {
    if (slug in music) return
    let cancelled = false
    fetch(`/api/music/story?niche=${slug}`)
      .then((response) => response.json() as Promise<ApiResponse<{ music: StoryMusic | null }>>)
      .then((body) => {
        if (!cancelled)
          setMusic((map) => ({ ...map, [slug]: body.success ? body.data.music : null }))
      })
      .catch(() => {
        if (!cancelled) setMusic((map) => ({ ...map, [slug]: null }))
      })
    return () => {
      cancelled = true
    }
  }, [music, slug])

  // Track for this niche (crossfades from the previous niche's track).
  useEffect(() => {
    if (current === undefined) return
    const engine = getAudioEngine()
    if (!current) {
      engine.stop("story")
      return
    }
    engine.play(
      {
        id: `story:${current.previewUrl}`,
        src: current.previewUrl,
        title: current.title,
        artist: current.artist,
        artworkUrl: current.artworkUrl,
      },
      { owner: "story", loop: true },
    )
  }, [current])

  // Hold to pause pauses the music too.
  useEffect(() => {
    const engine = getAudioEngine()
    if (engine.getState().owner !== "story") return
    if (paused) engine.pause()
    else engine.resume()
  }, [paused, current])

  // Opening a story pauses the player; closing it stops only story audio and
  // hands the player's queue back (paused, ready to resume where it was).
  useEffect(() => {
    const engine = getAudioEngine()
    const before = engine.getState()
    const handBack = before.owner === "player" && before.track ? before : null
    if (handBack) engine.pause()
    return () => {
      engine.stop("story")
      if (handBack && engine.getState().track === null) {
        engine.cue(handBack.queue, handBack.index, { owner: "player", context: handBack.context })
      }
    }
  }, [])

  return current
}
