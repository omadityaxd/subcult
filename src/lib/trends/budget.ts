export interface Reservation {
  /** Replace the estimate with what the job actually cost (null: keep the estimate). */
  settle(actualUsd: number | null): void
}

export interface Budget {
  readonly limitUsd: number
  /** Settled spend plus outstanding reservations. */
  committedUsd(): number
  /** Reserve before spending; null means the job would push us past the cap. */
  reserve(estimateUsd: number): Reservation | null
}

/**
 * A hard per-run spending cap. Every LLM job reserves a conservative estimate
 * first, so concurrent jobs can never collectively overshoot the cap.
 */
export function createBudget(limitUsd: number): Budget {
  let committed = 0

  return {
    limitUsd,
    committedUsd: () => committed,
    reserve(estimateUsd) {
      if (committed + estimateUsd > limitUsd) return null
      committed += estimateUsd
      let settled = false
      return {
        settle(actualUsd) {
          if (settled) return
          settled = true
          if (actualUsd !== null) committed += actualUsd - estimateUsd
        },
      }
    },
  }
}
