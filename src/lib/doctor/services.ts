/**
 * Every external service subcult can use: which env vars switch it on, what
 * it unlocks, and a cheap call that proves the key works. Shared by
 * `pnpm doctor` and /admin/status, so both always agree.
 */

export type Env = Readonly<Record<string, string | undefined>>
type Fetch = typeof fetch

export interface Probe {
  /** true = the call worked; false = it failed; null = not checked (nothing to ping). */
  reachable: boolean | null
  detail: string
  /** Quota left, when the service tells us (or we count it ourselves). */
  quota?: string | null
}

export interface Service {
  id: string
  label: string
  /** All of these must be set for the service to be on. */
  vars: readonly string[]
  /** Optional extras that improve the service (shown, never required). */
  extras?: readonly string[]
  /** Required services fail `pnpm doctor` (non-zero exit) when missing or broken. */
  required: boolean
  unlocks: string
  probe?: (env: Env, fetch: Fetch) => Promise<Probe>
}

export interface ServiceRow {
  id: string
  label: string
  required: boolean
  present: boolean
  missing: string[]
  reachable: boolean | null
  detail: string
  quota: string | null
  unlocks: string
  /** The feature is live: keys present and the ping didn't fail. */
  on: boolean
}

const TIMEOUT_MS = 8000

async function call(fetchImpl: Fetch, url: string, init: RequestInit = {}): Promise<Response> {
  return fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" })
}

const ok = (detail: string, quota: string | null = null): Probe => ({
  reachable: true,
  detail,
  quota,
})
const failed = (detail: string): Probe => ({ reachable: false, detail })
const status = (response: Response) => `HTTP ${response.status}`

async function oauthClientCredentials(
  fetchImpl: Fetch,
  url: string,
  id: string,
  secret: string,
  body: string,
): Promise<Probe> {
  const response = await call(fetchImpl, url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })
  return response.ok ? ok("token issued") : failed(`token refused (${status(response)})`)
}

export const SERVICES: readonly Service[] = [
  {
    id: "database",
    label: "Postgres (Supabase)",
    vars: ["DATABASE_URL"],
    required: true,
    unlocks: "Accounts' data: taste sync, fits, follows, votes, alerts",
  },
  {
    id: "supabase",
    label: "Supabase Auth",
    vars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
    required: true,
    unlocks: "Sign-in (Google, magic link)",
    probe: async (env, fetchImpl) => {
      const response = await call(fetchImpl, `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
        headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
      })
      return response.ok ? ok("auth healthy") : failed(status(response))
    },
  },
  {
    id: "supabase-secret",
    label: "Supabase secret key",
    vars: ["SUPABASE_SECRET_KEY"],
    required: false,
    unlocks: "Posting fits (photo uploads), account deletion",
    probe: async (env, fetchImpl) => {
      if (!env.NEXT_PUBLIC_SUPABASE_URL) return failed("needs NEXT_PUBLIC_SUPABASE_URL too")
      const response = await call(fetchImpl, `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/bucket`, {
        // New-style secret keys aren't JWTs: they go in `apikey` only.
        headers: { apikey: env.SUPABASE_SECRET_KEY ?? "" },
      })
      return response.ok ? ok("storage reachable") : failed(status(response))
    },
  },
  {
    id: "redis",
    label: "Upstash Redis",
    vars: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    required: true,
    unlocks: "Shared cache, rate limits, quotas, Rising snapshot",
    probe: async (env, fetchImpl) => {
      const response = await call(fetchImpl, `${env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
      })
      return response.ok ? ok("PONG") : failed(status(response))
    },
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    vars: ["ANTHROPIC_API_KEY"],
    required: false,
    unlocks: "Vision tagging (fits, pins, alt text), new niche generation, vibe blurbs",
    probe: async (env, fetchImpl) => {
      const response = await call(fetchImpl, "https://api.anthropic.com/v1/models?limit=1", {
        headers: { "x-api-key": env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" },
      })
      return response.ok ? ok("key valid") : failed(status(response))
    },
  },
  {
    id: "spotify",
    label: "Spotify Web API",
    vars: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"],
    required: false,
    unlocks: "Exact Spotify links, artist images, Spotify search in feeds",
    probe: (env, fetchImpl) =>
      oauthClientCredentials(
        fetchImpl,
        "https://accounts.spotify.com/api/token",
        env.SPOTIFY_CLIENT_ID ?? "",
        env.SPOTIFY_CLIENT_SECRET ?? "",
        "grant_type=client_credentials",
      ),
  },
  {
    id: "youtube",
    label: "YouTube Data API",
    vars: ["YOUTUBE_API_KEY"],
    required: false,
    unlocks: "Videos, fit-check Shorts",
    probe: async (env, fetchImpl) => {
      // videos.list costs 1 unit (a search costs 100).
      const response = await call(
        fetchImpl,
        `https://www.googleapis.com/youtube/v3/videos?part=id&id=jNQXAC9IVRw&key=${env.YOUTUBE_API_KEY}`,
      )
      if (response.ok) return ok("key valid")
      const text = await response.text().catch(() => "")
      return failed(/quota/i.test(text) ? "daily quota exhausted" : status(response))
    },
  },
  {
    id: "ebay",
    label: "eBay Browse API",
    vars: ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"],
    extras: ["EBAY_CAMPAIGN_ID"],
    required: false,
    unlocks: "The Grail, Archive tabs, shop the look, grail alerts, product sheets",
    probe: (env, fetchImpl) =>
      oauthClientCredentials(
        fetchImpl,
        "https://api.ebay.com/identity/v1/oauth2/token",
        env.EBAY_CLIENT_ID ?? "",
        env.EBAY_CLIENT_SECRET ?? "",
        "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
      ),
  },
  {
    id: "unsplash",
    label: "Unsplash",
    vars: ["UNSPLASH_ACCESS_KEY"],
    required: false,
    unlocks: "Moodboard photos",
    probe: async (env, fetchImpl) => {
      const response = await call(fetchImpl, "https://api.unsplash.com/photos?per_page=1", {
        headers: { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}`, "Accept-Version": "v1" },
      })
      const left = response.headers.get("x-ratelimit-remaining")
      return response.ok ? ok("key valid", left ? `${left}/hour` : null) : failed(status(response))
    },
  },
  {
    id: "pexels",
    label: "Pexels",
    vars: ["PEXELS_API_KEY"],
    required: false,
    unlocks: "Moodboard photos",
    probe: async (env, fetchImpl) => {
      const response = await call(fetchImpl, "https://api.pexels.com/v1/curated?per_page=1", {
        headers: { Authorization: env.PEXELS_API_KEY ?? "" },
      })
      const left = response.headers.get("x-ratelimit-remaining")
      return response.ok ? ok("key valid", left ? `${left}/month` : null) : failed(status(response))
    },
  },
  {
    id: "arena",
    label: "Are.na",
    vars: [],
    extras: ["ARENA_ACCESS_TOKEN"],
    required: false,
    unlocks: "Moodboard channels (works without a token; a token raises the rate limit)",
    probe: async (env, fetchImpl) => {
      const response = await call(
        fetchImpl,
        "https://api.are.na/v2/channels/brand-rick-owens?per=1",
        {
          headers: env.ARENA_ACCESS_TOKEN
            ? { Authorization: `Bearer ${env.ARENA_ACCESS_TOKEN}` }
            : {},
        },
      )
      return response.ok ? ok("reachable") : failed(status(response))
    },
  },
  {
    id: "itunes",
    label: "iTunes Search",
    vars: [],
    required: false,
    unlocks: "30-second previews, releases (no key needed)",
    probe: async (_env, fetchImpl) => {
      const response = await call(fetchImpl, "https://itunes.apple.com/search?term=bladee&limit=1")
      return response.ok ? ok("reachable") : failed(status(response))
    },
  },
  {
    id: "posthog",
    label: "PostHog",
    vars: ["NEXT_PUBLIC_POSTHOG_KEY"],
    extras: ["NEXT_PUBLIC_POSTHOG_HOST"],
    required: false,
    unlocks: "Product analytics and funnels",
    probe: async (env) =>
      /^phc_[A-Za-z0-9]{20,}$/.test(env.NEXT_PUBLIC_POSTHOG_KEY ?? "")
        ? { reachable: null, detail: "key looks right (not pinged: it would log an event)" }
        : failed("doesn't look like a PostHog project key (phc_…)"),
  },
  {
    id: "push",
    label: "Web push (VAPID)",
    vars: ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"],
    required: false,
    unlocks: "Push alerts",
    probe: async (env) => {
      const publicOk = /^[A-Za-z0-9_-]{86,88}$/.test(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "")
      const privateOk = /^[A-Za-z0-9_-]{42,44}$/.test(env.VAPID_PRIVATE_KEY ?? "")
      return publicOk && privateOk
        ? { reachable: null, detail: "key pair well-formed" }
        : failed("malformed: run `npx web-push generate-vapid-keys`")
    },
  },
  {
    id: "admin",
    label: "Admin secret",
    vars: ["ADMIN_SECRET"],
    required: false,
    unlocks: "/admin (incl. this status page); required in production",
  },
  {
    id: "cron",
    label: "Cron secret",
    vars: ["CRON_SECRET"],
    required: false,
    unlocks: "Scheduled jobs (keep-alive, trends, Rising, alerts); required in production",
  },
  {
    id: "site",
    label: "Site URL",
    vars: ["NEXT_PUBLIC_SITE_URL"],
    required: false,
    unlocks: "Absolute share and OG links (Vercel's URL is used when unset)",
  },
]

/** Checks every service: presence, then (when present) its ping. Never throws. */
export async function checkServices(
  env: Env,
  {
    fetchImpl = fetch,
    extraProbes = {},
    quotas = {},
  }: {
    fetchImpl?: Fetch
    /** Probes that need server code (database, our own quota counters). */
    extraProbes?: Readonly<Record<string, () => Promise<Probe>>>
    quotas?: Readonly<Record<string, string>>
  } = {},
): Promise<ServiceRow[]> {
  return Promise.all(
    SERVICES.map(async (service) => {
      const missing = service.vars.filter((name) => !env[name]?.trim())
      const present = missing.length === 0
      let probe: Probe = { reachable: null, detail: present ? "set" : "not set" }
      const run =
        extraProbes[service.id] ?? (service.probe ? () => service.probe!(env, fetchImpl) : null)
      if (present && run) {
        probe = await run().catch((error: unknown) =>
          failed(error instanceof Error ? error.message.slice(0, 120) : "failed"),
        )
      }
      return {
        id: service.id,
        label: service.label,
        required: service.required,
        present,
        missing,
        reachable: probe.reachable,
        detail: probe.detail,
        quota: quotas[service.id] ?? probe.quota ?? null,
        unlocks: service.unlocks,
        on: present && probe.reachable !== false,
      }
    }),
  )
}

/** `pnpm doctor` fails only when a required service is missing or broken. */
export function doctorFails(rows: readonly ServiceRow[]): boolean {
  return rows.some((row) => row.required && !row.on)
}

/** Plain-text table for the terminal. */
export function formatTable(rows: readonly ServiceRow[]): string {
  const mark = (row: ServiceRow) => (row.on ? "ON " : row.present ? "ERR" : "off")
  const reach = (row: ServiceRow) =>
    row.reachable === true ? "yes" : row.reachable === false ? "NO" : "-"
  const header = ["", "service", "key", "reachable", "quota left", "detail"]
  const lines = rows.map((row) => [
    mark(row),
    `${row.label}${row.required ? " *" : ""}`,
    row.present ? "yes" : `missing ${row.missing.join(", ")}`,
    reach(row),
    row.quota ?? "-",
    row.detail,
  ])
  const widths = header.map((h, i) => Math.max(h.length, ...lines.map((l) => (l[i] ?? "").length)))
  const fmt = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join("  ")
  return [fmt(header), ...lines.map(fmt), "", "* required"].join("\n")
}
