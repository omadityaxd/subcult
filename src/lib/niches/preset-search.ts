import type { NichePreset } from "./catalog"

const loose = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

/**
 * Case- and punctuation-insensitive match on a niche's name or any alias.
 * Client-safe: only a type import, so no catalog or graph data reaches the bundle.
 */
export function presetMatches(
  preset: Pick<NichePreset, "name" | "aliases">,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const looseNeedle = loose(needle)
  return [preset.name, ...preset.aliases].some(
    (text) => text.toLowerCase().includes(needle) || loose(text).includes(looseNeedle),
  )
}

/** True when the query *is* this niche (name or alias), so we never summon a duplicate. */
export function presetIs(preset: Pick<NichePreset, "name" | "aliases">, query: string): boolean {
  const target = loose(query)
  return (
    target.length > 0 && [preset.name, ...preset.aliases].some((text) => loose(text) === target)
  )
}
