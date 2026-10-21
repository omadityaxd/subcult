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
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optional,
  /** Server-only Supabase secret key (replaces the legacy service_role key). */
  SUPABASE_SECRET_KEY: optional,
  DATABASE_URL: optional,
  /** Session pooler / direct connection, used only by drizzle-kit migrations. */
  DIRECT_URL: optional,
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optional,
  SPOTIFY_CLIENT_ID: optional,
  SPOTIFY_CLIENT_SECRET: optional,
  YOUTUBE_API_KEY: optional,
  /** Moodboard image sources, each optional (missing = skipped, share redistributed). */
  UNSPLASH_ACCESS_KEY: optional,
  PEXELS_API_KEY: optional,
  /** eBay Browse API (archive listings, product sheets). Both required; else the shop hides. */
  EBAY_CLIENT_ID: optional,
  EBAY_CLIENT_SECRET: optional,
  /** Optional eBay Partner Network campaign id: "Buy on eBay" then uses affiliate links. */
  EBAY_CAMPAIGN_ID: optional,
  /** Are.na channels are readable without it; a token only raises the rate limit. */
  ARENA_ACCESS_TOKEN: optional,
  /** "1" turns on Spotify Connect (Web Playback SDK + save to library). Dev mode = 5 users. */
  NEXT_PUBLIC_SPOTIFY_CONNECT: optional,
  NEXT_PUBLIC_POSTHOG_KEY: optional,
  NEXT_PUBLIC_POSTHOG_HOST: optionalUrl,
  AMAZON_AFFILIATE_TAG: optional,
  /** Storefront for Amazon search links, e.g. amazon.in. */
  AMAZON_DOMAIN: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .string()
      .regex(/^amazon.[a-z.]{2,10}$/, "must look like amazon.com or amazon.in")
      .default("amazon.com"),
  ),
  NEXT_PUBLIC_SITE_URL: optionalUrl,
  /** Global ceiling on new LLM niche generations per UTC day (on top of per-IP limits). */
  LLM_DAILY_GENERATION_CAP: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().min(0).default(30),
  ),
  /** Vision tagging requests (up to 6 images each) per UTC day; separate from the generation cap. */
  VISION_DAILY_BATCH_CAP: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().min(0).default(60),
  ),
  /** Web push (VAPID). Generate once: `npx web-push generate-vapid-keys`. Push is off when unset. */
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
  /** Password for /admin (HTTP Basic auth). Admin is disabled (404) when unset. */
  ADMIN_SECRET: optional,
  /** Vercel sends `Authorization: Bearer $CRON_SECRET` to cron routes. */
  CRON_SECRET: optional,
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

/** Unset on production, these leave /admin open to nobody and the scheduled jobs unauthenticated. */
export const REQUIRED_IN_PRODUCTION = ["ADMIN_SECRET", "CRON_SECRET"] as const

/** The production-only secrets that are missing (empty outside Vercel production). */
export function missingProductionSecrets(source: Record<string, string | undefined>): string[] {
  if (source.VERCEL_ENV !== "production") return []
  return REQUIRED_IN_PRODUCTION.filter((name) => !source[name]?.trim())
}

function parseEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env)
  if (!result.success) {
    // A malformed value (e.g. a broken URL) is a config bug worth failing loudly on.
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`)
  }
  const missing = missingProductionSecrets(process.env)
  if (missing.length > 0) {
    throw new Error(
      `Production needs ${missing.join(" and ")} (see docs/KEYS.md). Set them in Vercel and redeploy.`,
    )
  }
  return result.data
}

export const env: ServerEnv = parseEnv()

export const features = {
  llm: Boolean(env.ANTHROPIC_API_KEY),
  database: Boolean(env.DATABASE_URL),
  auth: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  cache: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
  spotify: Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET),
  youtube: Boolean(env.YOUTUBE_API_KEY),
  ebay: Boolean(env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET),
  spotifyConnect: env.NEXT_PUBLIC_SPOTIFY_CONNECT === "1" && Boolean(env.SPOTIFY_CLIENT_ID),
  analytics: Boolean(env.NEXT_PUBLIC_POSTHOG_KEY),
  push: Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
} as const

export type Feature = keyof typeof features

/**
 * Absolute origin for metadata (OG image URLs, share links). Explicit config
 * wins; on Vercel the production domain (or the preview URL) is the fallback,
 * so share cards never point at localhost.
 */
export function resolveSiteUrl(source: Record<string, string | undefined>): string {
  if (source.NEXT_PUBLIC_SITE_URL) return source.NEXT_PUBLIC_SITE_URL
  const vercelHost =
    source.VERCEL_ENV === "production"
      ? (source.VERCEL_PROJECT_PRODUCTION_URL ?? source.VERCEL_URL)
      : source.VERCEL_URL
  return vercelHost ? `https://${vercelHost}` : "http://localhost:3000"
}

export const siteUrl = resolveSiteUrl({
  NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL,
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_URL: process.env.VERCEL_URL,
})
