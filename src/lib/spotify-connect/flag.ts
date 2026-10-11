/**
 * Spotify Connect is behind a build-time flag (NEXT_PUBLIC_SPOTIFY_CONNECT=1):
 * in development mode Spotify lets only 5 allowlisted Premium accounts use it.
 */
export const SPOTIFY_CONNECT_ENABLED = process.env.NEXT_PUBLIC_SPOTIFY_CONNECT === "1"

/** Shown wherever the feature is offered, so nobody is surprised by a 403. */
export const SPOTIFY_CONNECT_LIMIT =
  "Beta: needs Spotify Premium, and while subcult is in Spotify's development mode only 5 invited accounts can connect."
