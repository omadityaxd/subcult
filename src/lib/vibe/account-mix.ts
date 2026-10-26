/**
 * An account's latest vibe check, recovered from its synced taste signals:
 * a vibe check records one "vibe_check" signal per niche of the mix, all at
 * the same moment, with the niche's share as the strength. Pure.
 */
export interface VibeSignalLike {
  kind: string
  entity: string
  strength: number
  at: number
}

/** Niche slugs of the most recent vibe check, biggest share first; null if there's none. */
export function latestVibeMix(signals: readonly VibeSignalLike[]): string[] | null {
  const vibe = signals.filter((s) => s.kind === "vibe_check" && s.entity.startsWith("niche:"))
  if (vibe.length === 0) return null
  const latest = Math.max(...vibe.map((s) => s.at))
  const mix = vibe
    .filter((s) => s.at === latest)
    .sort((a, b) => b.strength - a.strength)
    .map((s) => s.entity.slice("niche:".length))
  return mix.length > 0 ? [...new Set(mix)] : null
}
