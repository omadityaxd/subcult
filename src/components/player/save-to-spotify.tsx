"use client"

import { Check, Plus } from "lucide-react"
import { useState } from "react"
import { saveToLibrary } from "@/lib/spotify-connect/player"

/** Connected listeners only: adds the track to their Spotify library (PUT /me/library). */
export function SaveToSpotify({ uri }: { uri: string }) {
  const [state, setState] = useState<{ uri: string; status: "saving" | "saved" | "failed" } | null>(
    null,
  )
  const status = state?.uri === uri ? state.status : "idle"

  return (
    <button
      type="button"
      disabled={status === "saving" || status === "saved"}
      onClick={() => {
        setState({ uri, status: "saving" })
        saveToLibrary(uri)
          .then(() => setState({ uri, status: "saved" }))
          .catch(() => setState({ uri, status: "failed" }))
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/30 px-3 text-footnote font-medium text-white hover:bg-white/10 disabled:opacity-70"
    >
      {status === "saved" ? (
        <Check aria-hidden className="size-3.5" strokeWidth={2} />
      ) : (
        <Plus aria-hidden className="size-3.5" strokeWidth={2} />
      )}
      {status === "saved"
        ? "Saved to Spotify"
        : status === "failed"
          ? "Couldn't save, try again"
          : "Save to Spotify"}
    </button>
  )
}
