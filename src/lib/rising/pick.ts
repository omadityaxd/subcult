import type { Momentum } from "./momentum"

/** Rising in The Scene always shows at least this many entities when they exist. */
export const RISING_MIN = 5

/** Where a rising entity came from, so the issue can say when it widened. */
export type RisingScope = "yours" | "nearby" | "everywhere"

export interface PickedRising {
  momentum: Momentum
  scope: RisingScope
}

/**
 * Rising for a reader: their entities and niches first; under RISING_MIN,
 * widen to adjacent niches, then to everything rising (each labelled, so
 * the issue can say it widened). Strongest first within each scope.
 */
export function pickRising(
  entities: readonly Momentum[],
  scope: {
    niches: readonly string[]
    mine: ReadonlySet<string>
    adjacent: readonly string[]
    /**
     * A niche page: "yours" is only this niche's verified entities, the
     * adjacent niches are "nearby", and nothing from further away.
     */
    verified?: ReadonlySet<string>
  },
  limit: number,
): PickedRising[] {
  const used = new Set<string>()
  const take = (pool: readonly Momentum[], label: RisingScope): PickedRising[] =>
    pool.flatMap((momentum) => {
      if (used.has(momentum.entity)) return []
      used.add(momentum.entity)
      return [{ momentum, scope: label }]
    })
  const touches = (m: Momentum, niches: readonly string[]) =>
    m.niches.some((n) => niches.includes(n))

  const out = take(
    entities.filter((m) =>
      scope.verified
        ? scope.verified.has(m.entity)
        : scope.mine.has(m.entity) || touches(m, scope.niches),
    ),
    "yours",
  )
  if (out.length < RISING_MIN) {
    out.push(
      ...take(
        entities.filter((m) => touches(m, scope.adjacent)),
        "nearby",
      ).slice(0, RISING_MIN - out.length),
    )
  }
  if (out.length < RISING_MIN && !scope.verified) {
    out.push(...take(entities, "everywhere").slice(0, RISING_MIN - out.length))
  }
  return out.slice(0, Math.max(limit, 0))
}
