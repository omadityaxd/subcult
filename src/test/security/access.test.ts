import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Permanent access tests: guests can't write, and admin/cron need their
 * secrets. Routes are discovered from the file system, so a new API route
 * is covered (or fails here) without editing this file.
 */

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/server", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getViewer: vi.fn(async () => null),
}))
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  headers: vi.fn(async () => new Headers()),
}))

type Handler = (request: Request, ctx?: unknown) => Promise<Response>
type RouteModule = Partial<Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE", Handler>>

const routes = import.meta.glob<RouteModule>("../../app/api/**/route.ts")

/**
 * Writes a guest may make on purpose, and why none of them touch an
 * account's data. Anything not listed must answer a guest with 401.
 */
const GUEST_WRITES: Record<string, string> = {
  "POST music/previews": "looks up 30s previews; reads only",
  "POST moodboard/unsplash-use": "tells Unsplash a photo was used; no data of ours",
  "POST niches": "generates a public niche; per-IP limit and daily cap",
  "POST search/trending": "counts a search for the trending list; anonymous",
  "POST today": "builds an issue from the posted taste; reads only",
  "POST vibe-check/blurb": "writes a blurb for the posted mix; reads only",
  "POST vote": "anonymous device vote by design; per-IP limit",
  "POST wrapped/slide": "renders an image from the posted summary; reads only",
}

const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const
const ORIGIN = "http://localhost:3000"
const PARAMS = {
  params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000000", slug: "rage" }),
}

const routeName = (file: string) => file.replace("../../app/api/", "").replace("/route.ts", "")

function sameOriginRequest(path: string, method: string): Request {
  return new Request(`${ORIGIN}/api/${path}`, {
    method,
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body: method === "GET" ? undefined : "{}",
  })
}

describe("guests", () => {
  it("finds the API routes", () => {
    expect(Object.keys(routes).length).toBeGreaterThan(30)
  })

  for (const [file, load] of Object.entries(routes)) {
    const name = routeName(file)
    it(`can't write through ${name} unless it's a listed guest action`, async () => {
      const mod = await load()
      for (const method of WRITE_METHODS) {
        const handler = mod[method]
        if (!handler || GUEST_WRITES[`${method} ${name}`]) continue
        if (name.startsWith("cron/")) continue // GET-only, covered below
        const response = await handler(
          sameOriginRequest(name.replace(/\[(\w+)\]/g, "x"), method),
          PARAMS,
        )
        expect(response.status, `${method} /api/${name}`).toBe(401)
      }
    }, 30_000) // the first import transforms most of the app
  }

  it("has no stale guest-write allowances", async () => {
    for (const key of Object.keys(GUEST_WRITES)) {
      const [method, name] = key.split(" ") as [keyof RouteModule, string]
      const load = routes[`../../app/api/${name}/route.ts`]
      expect(load, key).toBeDefined()
      expect((await load!())[method], key).toBeTypeOf("function")
    }
  })
})

const CRON_SECRET = "test-cron-secret-with-enough-length-0123"
const cronRoutes = Object.keys(routes).filter((file) => routeName(file).startsWith("cron/"))

async function cronResponses(authorization: string | null) {
  vi.resetModules()
  const out: Record<string, number> = {}
  for (const file of cronRoutes) {
    const mod = await routes[file]!()
    const headers = new Headers(authorization ? { authorization } : {})
    const response = await mod.GET!(new Request(`${ORIGIN}/api/${routeName(file)}`, { headers }))
    out[routeName(file)] = response.status
  }
  return out
}

describe("cron routes", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("covers every cron route", () => {
    expect(cronRoutes.map(routeName).sort()).toEqual([
      "cron/alerts",
      "cron/keep-alive",
      "cron/rising",
      "cron/trends",
    ])
  })

  it.each([
    ["no header", null],
    ["a wrong secret", `Bearer ${CRON_SECRET}x`],
    ["the secret without Bearer", CRON_SECRET],
    ["Basic auth", `Basic ${btoa(`cron:${CRON_SECRET}`)}`],
  ])("refuse %s", async (_label, authorization) => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET)
    for (const [route, status] of Object.entries(await cronResponses(authorization))) {
      expect(status, route).toBe(401)
    }
  })

  it.each(["Bearer ", "Bearer undefined", "Bearer null"])(
    "fail closed when CRON_SECRET is unset (%s)",
    async (authorization) => {
      vi.stubEnv("CRON_SECRET", "")
      for (const [route, status] of Object.entries(await cronResponses(authorization))) {
        expect(status, route).toBe(401)
      }
    },
  )
})

const ADMIN_SECRET = "test-admin-secret-with-enough-length-0123"
const ADMIN_PATHS = ["/admin", "/admin/status", "/admin/fits", "/admin/niches", "/admin/usage"]

async function adminStatus(path: string, authorization?: string): Promise<number> {
  vi.resetModules()
  const { proxy } = await import("@/proxy")
  const headers = new Headers(authorization ? { authorization } : {})
  return (await proxy(new NextRequest(`${ORIGIN}${path}`, { headers }))).status
}

const basic = (password: string) => `Basic ${btoa(`admin:${password}`)}`

describe("admin", () => {
  beforeEach(() => {
    // The lockout counter is Redis-backed; these tests check the gate itself.
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "")
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each(ADMIN_PATHS)("%s asks for the password without it, or with a wrong one", async (path) => {
    vi.stubEnv("ADMIN_SECRET", ADMIN_SECRET)
    expect(await adminStatus(path)).toBe(401)
    expect(await adminStatus(path, basic(`${ADMIN_SECRET}x`))).toBe(401)
    expect(await adminStatus(path, `Bearer ${ADMIN_SECRET}`)).toBe(401)
    expect(await adminStatus(path, basic(ADMIN_SECRET))).toBe(200)
  })

  it.each(ADMIN_PATHS)("%s doesn't exist when ADMIN_SECRET is unset", async (path) => {
    vi.stubEnv("ADMIN_SECRET", "")
    expect(await adminStatus(path)).toBe(404)
    expect(await adminStatus(path, basic(""))).toBe(404)
  })

  it("server actions refuse callers without the admin password", async () => {
    vi.stubEnv("ADMIN_SECRET", ADMIN_SECRET)
    vi.resetModules()
    const { setFitStatusAction } = await import("@/app/admin/fits/actions")
    const { setNicheStatusAction } = await import("@/app/admin/niches/actions")
    const form = new FormData()
    form.set("id", "00000000-0000-4000-8000-000000000000")
    form.set("status", "hidden")
    await expect(setFitStatusAction(form)).rejects.toThrow("unauthorized")
    await expect(setNicheStatusAction(form)).rejects.toThrow("unauthorized")
  })
})
