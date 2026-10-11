import type { Metadata } from "next"
import { SpotifyCallback } from "./spotify-callback"

export const metadata: Metadata = { title: "Connecting Spotify", robots: { index: false } }

/** Spotify sends the listener back here after the consent screen (PKCE). */
export default function SpotifyCallbackPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <SpotifyCallback />
    </main>
  )
}
