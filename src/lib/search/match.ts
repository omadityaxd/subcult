/** Something search can find by name: an artist, a brand, a niche. */
export interface Searchable {
  slug: string
  name: string
  aliases?: readonly string[]
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\$/g, "s")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

/**
 * How well a name answers a query: exact 4, starts with it 3, a word starts
 * with it 2, contains it 1, no match 0. Aliases count too ("asap rocky").
 */
export function matchScore(query: string, entity: Searchable): number {
  const q = normalize(query)
  if (q.length === 0) return 0
  let best = 0
  for (const name of [entity.name, ...(entity.aliases ?? [])]) {
    const n = normalize(name)
    const score =
      n === q
        ? 4
        : n.startsWith(q)
          ? 3
          : n.split(" ").some((word) => word.startsWith(q))
            ? 2
            : q.length >= 3 && n.includes(q)
              ? 1
              : 0
    best = Math.max(best, score)
  }
  return best
}

/** The best matches, strongest first (then shortest name, then A–Z). */
export function searchEntities<T extends Searchable>(
  query: string,
  entities: readonly T[],
  limit: number,
): T[] {
  return entities
    .map((entity) => ({ entity, score: matchScore(query, entity) }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.entity.name.length - b.entity.name.length ||
        a.entity.name.localeCompare(b.entity.name),
    )
    .slice(0, limit)
    .map(({ entity }) => entity)
}

/** A query worth logging for "trending": it names a known entity exactly (never free text). */
export function resolvesTo<T extends Searchable>(query: string, entities: readonly T[]): T | null {
  return entities.find((entity) => matchScore(query, entity) === 4) ?? null
}
