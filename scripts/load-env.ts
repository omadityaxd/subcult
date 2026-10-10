/**
 * Loads .env.local then .env for CLI scripts (Next.js does this itself for
 * the app). Existing process env always wins; missing files are fine.
 */
export function loadLocalEnv(): void {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
  }
}
