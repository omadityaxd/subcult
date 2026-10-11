/**
 * Authorization Code with PKCE: the flow Spotify recommends for browser apps.
 * No client secret ever reaches the browser; the verifier proves the token
 * request came from whoever started the login.
 */

export const SPOTIFY_AUTHORIZE = "https://accounts.spotify.com/authorize"
export const SPOTIFY_TOKEN = "https://accounts.spotify.com/api/token"

/**
 * streaming + user-read-* : the Web Playback SDK.
 * user-modify-playback-state: start a song on our in-browser device.
 * user-library-modify: "Save to Spotify" (PUT /me/library).
 */
export const CONNECT_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-modify-playback-state",
  "user-library-modify",
] as const

const VERIFIER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"

/** 64 random characters from the RFC 7636 unreserved set. */
export function randomVerifier(
  random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b),
): string {
  const bytes = random(new Uint8Array(64))
  return Array.from(bytes, (byte) => VERIFIER_CHARS[byte % VERIFIER_CHARS.length]).join("")
}

export function base64Url(bytes: ArrayBuffer): string {
  let binary = ""
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** S256 challenge: base64url(sha256(verifier)). */
export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return base64Url(digest)
}

export function authorizeUrl({
  clientId,
  redirectUri,
  challenge,
  state,
}: {
  clientId: string
  redirectUri: string
  challenge: string
  state: string
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: CONNECT_SCOPES.join(" "),
    code_challenge_method: "S256",
    code_challenge: challenge,
    redirect_uri: redirectUri,
    state,
  })
  return `${SPOTIFY_AUTHORIZE}?${params}`
}
