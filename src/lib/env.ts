import "server-only"
import { z } from "zod"

/**
 * Every integration is optional so the app runs (and demos) with zero keys.
 * Missing keys disable the matching feature instead of crashing — see `features`.
 */
const optional = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional(),
)
const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.url().optional(),
)

const serverEnvSchema = z.object({
  ANTHROPIC_API_KEY: optional,
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional,
  SUPABASE_SERVICE_ROLE_KEY: optional,
  DATABASE_URL: optional,
  /** Session pooler / direct connection, used only by drizzle-kit migrations. */
  DIRECT_URL: optional,
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optional,
  SPOTIFY_CLIENT_ID: optional,
  SPOTIFY_CLIENT_SECRET: optional,
  YOUTUBE_API_KEY: optional,
  REDDIT_CLIENT_ID: optional,
  REDDIT_CLIENT_SECRET: optional,
  NEXT_PUBLIC_POSTHOG_KEY: optional,
  NEXT_PUBLIC_POSTHOG_HOST: optionalUrl,
  AMAZON_AFFILIATE_TAG: optional,
  NEXT_PUBLIC_SITE_URL: optionalUrl,
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

function parseEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env)
  if (!result.success) {
    // A malformed value (e.g. a broken URL) is a config bug worth failing loudly on.
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}

export const env: ServerEnv = parseEnv()

export const features = {
  llm: Boolean(env.ANTHROPIC_API_KEY),
  database: Boolean(env.DATABASE_URL),
  auth: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  cache: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
  spotify: Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET),
  youtube: Boolean(env.YOUTUBE_API_KEY),
  redditOAuth: Boolean(env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET),
  analytics: Boolean(env.NEXT_PUBLIC_POSTHOG_KEY),
} as const

export type Feature = keyof typeof features

export const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
