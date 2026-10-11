"use client"

import { useSyncExternalStore } from "react"
import { z } from "zod"
import { SPOTIFY_TOKEN, authorizeUrl, challengeFor, randomVerifier } from "./pkce"

/**
 * The listener's Spotify login, kept in this browser only (localStorage).
 * Tokens live an hour; the refresh token renews them without a new login.
 */
const SESSION_KEY = "subcult-spotify-session"
const PENDING_KEY = "subcult-spotify-pkce"
const REFRESH_MARGIN_MS = 60_000

const sessionSchema = z.object({
  clientId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
})
export type SpotifySession = z.infer<typeof sessionSchema>

const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
})

const listeners = new Set<() => void>()
let cachedRaw: string | null | undefined
let cachedSession: SpotifySession | null = null

function read(): SpotifySession | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
  if (raw === cachedRaw) return cachedSession
  cachedRaw = raw
  let json: unknown = null
  try {
    json = raw ? JSON.parse(raw) : null
  } catch {
    // Corrupt entry: treat as signed out.
  }
  const parsed = json ? sessionSchema.safeParse(json) : null
  cachedSession = parsed?.success ? parsed.data : null
  return cachedSession
}

function write(session: SpotifySession | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // Private mode: the login lasts for this page only.
  }
  listeners.forEach((listener) => listener())
}

/** Is this browser connected to Spotify? (Re-renders on connect/disconnect.) */
export function useSpotifySession(): SpotifySession | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    read,
    () => null,
  )
}

export const redirectUri = () => `${window.location.origin}/spotify/callback`

/** Step 1: send the listener to Spotify's consent screen. */
export async function startSpotifyLogin(clientId: string): Promise<void> {
  const verifier = randomVerifier()
  const state = randomVerifier().slice(0, 16)
  sessionStorage.setItem(
    PENDING_KEY,
    JSON.stringify({ verifier, state, clientId, returnTo: window.location.pathname }),
  )
  window.location.assign(
    authorizeUrl({
      clientId,
      redirectUri: redirectUri(),
      challenge: await challengeFor(verifier),
      state,
    }),
  )
}

async function requestToken(body: Record<string, string>) {
  const response = await fetch(SPOTIFY_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  })
  if (!response.ok) throw new Error(`Spotify token ${response.status}`)
  return tokenSchema.parse(await response.json())
}

/** Step 2 (on /spotify/callback): trade the code for tokens. Returns where to go back to. */
export async function finishSpotifyLogin(params: URLSearchParams): Promise<string> {
  const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null") as {
    verifier: string
    state: string
    clientId: string
    returnTo: string
  } | null
  sessionStorage.removeItem(PENDING_KEY)
  const error = params.get("error")
  if (error) throw new Error(error === "access_denied" ? "You said no; nothing changed." : error)
  const code = params.get("code")
  if (!pending || !code || params.get("state") !== pending.state) {
    throw new Error("That login link expired. Try connecting again.")
  }
  const token = await requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    client_id: pending.clientId,
    code_verifier: pending.verifier,
  })
  write({
    clientId: pending.clientId,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? "",
    expiresAt: Date.now() + token.expires_in * 1000,
  })
  return pending.returnTo.startsWith("/") ? pending.returnTo : "/me"
}

/** A valid access token, refreshed when it's about to expire; null when not connected. */
export async function getAccessToken(): Promise<string | null> {
  const session = read()
  if (!session) return null
  if (session.expiresAt - REFRESH_MARGIN_MS > Date.now()) return session.accessToken
  try {
    const token = await requestToken({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
      client_id: session.clientId,
    })
    const next = {
      ...session,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? session.refreshToken,
      expiresAt: Date.now() + token.expires_in * 1000,
    }
    write(next)
    return next.accessToken
  } catch {
    // Revoked or expired for good: drop the session so the UI offers Connect again.
    write(null)
    return null
  }
}

export function disconnectSpotify(): void {
  write(null)
}
