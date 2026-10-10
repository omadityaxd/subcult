type Level = "info" | "warn" | "error"
type Fields = Record<string, unknown>

/** Structured JSON-line logging (Vercel log drains parse these as fields). */
function write(level: Level, event: string, fields: Fields = {}): void {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...fields })
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  // eslint-disable-next-line no-console -- the one sanctioned info sink
  else console.info(line)
}

export const log = {
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
}

export type Logger = typeof log

const MAX_CAUSE_DEPTH = 3

/**
 * Message plus its `cause` chain: wrappers like Drizzle's "Failed query"
 * hide the real reason (auth, network, timeout) in `cause`.
 */
export function errorMessage(error: unknown, depth = 0): string {
  if (!(error instanceof Error)) return String(error)
  if (error.cause === undefined || depth >= MAX_CAUSE_DEPTH) return error.message
  return `${error.message} ← ${errorMessage(error.cause, depth + 1)}`
}
