"use client"

import { ResponsiveSheet } from "@/components/ds/responsive-sheet"
import { SpotifyEmbed } from "@/components/music/spotify-embed"
import { closeSpotifyFallback, useSpotifyFallback } from "@/lib/audio/spotify-fallback"

/**
 * Now Playing for a song without a 30-second preview: Spotify's own player,
 * in-app. It plays whatever Spotify allows this listener (full track with
 * Premium, a preview otherwise). Mounted once, next to the mini player.
 */
export function SpotifyFallbackSheet() {
  const track = useSpotifyFallback()
  return (
    <ResponsiveSheet
      open={track !== null}
      onOpenChange={(open) => (open ? undefined : closeSpotifyFallback())}
      title={track?.title ?? "Now playing"}
      description={track?.artist}
    >
      {track ? <SpotifyEmbed key={track.uri} uri={track.uri} height={152} autoPlay /> : null}
    </ResponsiveSheet>
  )
}
