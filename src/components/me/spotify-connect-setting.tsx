"use client"

import { useState } from "react"
import { SPOTIFY_CONNECT_LIMIT } from "@/lib/spotify-connect/flag"
import {
  disconnectSpotify,
  startSpotifyLogin,
  useSpotifySession,
} from "@/lib/spotify-connect/session"

/** Me → Settings: connect Spotify for full songs in the player (beta, flagged). */
export function SpotifyConnectSetting({ clientId }: { clientId: string }) {
  const session = useSpotifySession()
  const [busy, setBusy] = useState(false)

  return (
    <div className="rounded-2xl bg-card px-4 py-3 hairline-b">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-body">Spotify Connect</p>
          <p className="text-footnote text-muted-foreground">
            {session
              ? "Connected: full songs and Save to Spotify in the player."
              : "Full songs in the player."}
          </p>
        </div>
        {session ? (
          <button
            type="button"
            onClick={disconnectSpotify}
            className="h-9 shrink-0 rounded-full border border-border-strong px-4 text-footnote font-medium hover:bg-muted"
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void startSpotifyLogin(clientId).catch(() => setBusy(false))
            }}
            className="h-9 shrink-0 rounded-full bg-foreground px-4 text-footnote font-semibold text-background disabled:opacity-50"
          >
            Connect
          </button>
        )}
      </div>
      <p className="mt-2 text-caption text-subtle">{SPOTIFY_CONNECT_LIMIT}</p>
    </div>
  )
}
