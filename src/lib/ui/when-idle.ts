/** How long to wait for an idle moment before running anyway. */
const IDLE_TIMEOUT_MS = 5000

/**
 * Runs `task` once the page has loaded and the main thread is idle: after
 * the first paint and the cover, never competing with them. Used to fetch
 * the code for things that only open on a tap (story viewer, search, player)
 * so the tap is still instant. Client only; a no-op on the server.
 */
export function whenIdle(task: () => void): void {
  if (typeof window === "undefined") return
  const idle = () => {
    // Safari has no requestIdleCallback.
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS })
    } else globalThis.setTimeout(task, 1)
  }
  if (document.readyState === "complete") idle()
  else window.addEventListener("load", idle, { once: true })
}

/** Starts loading a lazily imported module when idle (errors are left to the real import). */
export function preloadWhenIdle(load: () => Promise<unknown>): void {
  whenIdle(() => void load().catch(() => undefined))
}
