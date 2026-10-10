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

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
