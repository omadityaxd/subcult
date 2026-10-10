export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`)
    this.name = "TimeoutError"
  }
}

/** Rejects with TimeoutError if `promise` doesn't settle within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = "operation"): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Like Promise.allSettled over `items.map(worker)`, but with at most `limit`
 * workers in flight. Results keep input order.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new Error(`Invalid concurrency limit: ${limit}`)

  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let next = 0

  async function runLane(): Promise<void> {
    while (next < items.length) {
      const index = next++
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index], index) }
      } catch (reason) {
        results[index] = { status: "rejected", reason }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runLane))
  return results
}
