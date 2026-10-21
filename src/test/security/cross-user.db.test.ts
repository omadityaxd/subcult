import { randomUUID } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { and, eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { type Database, createDb } from "@/db/create-db"
import { deleteAccountData, exportAccount } from "@/db/account-repository"
import { moderationQueue, reportFit } from "@/db/fit-repository"
import {
  fitLikes,
  fitReports,
  fitSaves,
  fits,
  grailSearches,
  notifications,
  profileSettings,
  profiles,
  pushSubscriptions,
  tasteSignals,
  userBlocks,
  userFollows,
  votes,
} from "@/db/schema"
import { AUTO_HIDE_REPORTS, TRUSTED_REPORTER_MIN_AGE_DAYS } from "@/lib/fits/schema"
import type { Viewer } from "@/lib/supabase/server"

/**
 * Two-account abuse tests against the real database. User A attacks user B
 * through every user-scoped API route, then the anon and signed-in database
 * roles try direct (PostgREST-style) access. Each test runs in a
 * transaction that is rolled back: nothing is left behind.
 *
 * Run with `pnpm run test:security` (needs DATABASE_URL in .env.local).
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  viewer: null as { id: string; email: string | null } | null,
  /** Users deleted from Supabase Auth: their tokens still verify, getUser() refuses them. */
  deleted: new Set<string>(),
  /** The Supabase admin client (null = no SUPABASE_SECRET_KEY). */
  admin: null as unknown,
}))

vi.mock("server-only", () => ({}))
vi.mock("@/db", () => ({ getDb: () => state.db }))
vi.mock("@/lib/supabase/server", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getViewer: vi.fn(async () => state.viewer),
  createSupabaseServer: vi.fn(async () => ({
    auth: {
      getUser: async () =>
        state.viewer && !state.deleted.has(state.viewer.id)
          ? { data: { user: { id: state.viewer.id } }, error: null }
          : { data: { user: null }, error: new Error("User from sub claim in JWT does not exist") },
      getSession: async () => ({
        data: { session: state.viewer ? { access_token: `token-of-${state.viewer.id}` } : null },
      }),
      signOut: async () => ({ error: null }),
    },
  })),
}))
vi.mock("@/lib/supabase/admin", () => ({ getStorageAdmin: () => state.admin }))

function databaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  if (!existsSync(".env.local")) return undefined
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL="))
  return line?.slice("DATABASE_URL=".length).trim() || undefined
}

const url = databaseUrl()
const ORIGIN = "http://localhost:3000"
const PUSH_B = `https://fcm.googleapis.com/fcm/send/test-${randomUUID()}`

interface Seed {
  a: Viewer & { handle: string }
  b: Viewer & { handle: string }
  c: Viewer & { handle: string }
  bFit: string
  bGrail: string
}

class Rollback extends Error {}

let base: ReturnType<typeof createDb> | null = null

async function seed(tx: Database): Promise<Seed> {
  const tag = randomUUID().replace(/-/g, "").slice(0, 8)
  const user = (name: string) => ({ id: randomUUID(), email: null, handle: `t_${name}_${tag}` })
  const [a, b, c] = [user("a"), user("b"), user("c")]
  await tx.insert(profiles).values([a, b, c].map(({ id, handle }) => ({ id, handle })))
  const [fit] = await tx
    .insert(fits)
    .values({ userId: b.id, imagePath: `${b.id}/test.webp`, width: 800, height: 1000 })
    .returning({ id: fits.id })
  const [grail] = await tx
    .insert(grailSearches)
    .values({
      userId: b.id,
      brandSlug: "rick-owens",
      brand: "Rick Owens",
      item: "geobaskets",
      maxPrice: 400,
    })
    .returning({ id: grailSearches.id })
  await tx.insert(notifications).values({
    userId: b.id,
    type: "friend",
    title: "B's private notification",
    url: "/me",
    dedupeKey: `test:${tag}`,
  })
  await tx.insert(tasteSignals).values({
    userId: b.id,
    kind: "save",
    entity: "artist:ken-carson",
    label: "Ken Carson",
    at: Date.now(),
  })
  await tx.insert(userFollows).values([
    { followerId: c.id, followeeId: b.id },
    { followerId: b.id, followeeId: c.id },
  ])
  await tx.insert(pushSubscriptions).values({
    userId: b.id,
    endpoint: PUSH_B,
    p256dh: "p256dh-key-of-b-xxxxxxxx",
    auth: "auth-of-b-xxxx",
  })
  return { a, b, c, bFit: fit!.id, bGrail: grail!.id }
}

/** Seeds A, B and C, runs the test, then rolls everything back. */
async function scenario(test: (s: Seed, tx: Database) => Promise<void>): Promise<void> {
  try {
    await base!.db.transaction(async (tx) => {
      state.db = tx
      await test(await seed(tx as unknown as Database), tx as unknown as Database)
      throw new Rollback()
    })
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  } finally {
    state.db = null
    state.viewer = null
    state.deleted.clear()
    state.admin = null
  }
}

const as = (viewer: Viewer | null) => {
  state.viewer = viewer ? { id: viewer.id, email: null } : null
}

function request(method: string, path: string, body?: unknown): Request {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) })

async function json(response: Response): Promise<{ success: boolean; data?: unknown }> {
  return (await response.json()) as { success: boolean; data?: unknown }
}

describe.skipIf(!url)("two accounts: A can't reach B's data", () => {
  beforeAll(() => {
    base = createDb(url!, { max: 1 })
  })
  afterAll(async () => {
    await base?.close()
  })

  it("fits: A can't read, delete, like, save or report B's friends-only fit", async () => {
    const route = await import("@/app/api/fits/[id]/route")
    const like = await import("@/app/api/fits/[id]/like/route")
    const save = await import("@/app/api/fits/[id]/save/route")
    const report = await import("@/app/api/fits/[id]/report/route")
    await scenario(async (s, tx) => {
      await tx.insert(profileSettings).values({ userId: s.b.id, visibility: "friends" })
      const id = params({ id: s.bFit })

      as(null)
      expect((await route.GET(request("GET", `/api/fits/${s.bFit}`), id)).status).toBe(404)
      as(s.a)
      expect((await route.GET(request("GET", `/api/fits/${s.bFit}`), id)).status).toBe(404)
      expect((await like.POST(request("POST", "/x"), id)).status).toBe(404)
      expect((await save.POST(request("POST", "/x"), id)).status).toBe(404)
      expect((await report.POST(request("POST", "/x", { reason: "nudity" }), id)).status).toBe(404)
      expect((await route.DELETE(request("DELETE", "/x"), id)).status).toBe(404)

      expect(await tx.select().from(fits).where(eq(fits.id, s.bFit))).toHaveLength(1)
      expect(await tx.select().from(fitLikes).where(eq(fitLikes.fitId, s.bFit))).toHaveLength(0)
      expect(await tx.select().from(fitSaves).where(eq(fitSaves.fitId, s.bFit))).toHaveLength(0)
      expect(await tx.select().from(fitReports).where(eq(fitReports.fitId, s.bFit))).toHaveLength(0)

      // Control: once they follow each other, A can see it.
      await tx.insert(userFollows).values([
        { followerId: s.a.id, followeeId: s.b.id },
        { followerId: s.b.id, followeeId: s.a.id },
      ])
      expect((await route.GET(request("GET", `/api/fits/${s.bFit}`), id)).status).toBe(200)
    })
  })

  it("fits: A can't delete B's public fit, and a block hides it", async () => {
    const route = await import("@/app/api/fits/[id]/route")
    await scenario(async (s, tx) => {
      const id = params({ id: s.bFit })
      as(s.a)
      expect((await route.GET(request("GET", "/x"), id)).status).toBe(200)
      expect((await route.DELETE(request("DELETE", "/x"), id)).status).toBe(404)
      expect(await tx.select().from(fits).where(eq(fits.id, s.bFit))).toHaveLength(1)

      await tx.insert(userBlocks).values({ blockerId: s.b.id, blockedId: s.a.id })
      expect((await route.GET(request("GET", "/x"), id)).status).toBe(404)
    })
  })

  it("grail hunts: A can't list or delete B's", async () => {
    const route = await import("@/app/api/grails/route")
    await scenario(async (s, tx) => {
      as(s.a)
      const listed = await json(await route.GET(request("GET", "/api/grails")))
      expect(JSON.stringify(listed)).not.toContain(s.bGrail)
      await route.DELETE(request("DELETE", `/api/grails?id=${s.bGrail}`))
      expect(
        await tx.select().from(grailSearches).where(eq(grailSearches.id, s.bGrail)),
      ).toHaveLength(1)
    })
  })

  it("notifications: A can't read B's or mark them read", async () => {
    const route = await import("@/app/api/notifications/route")
    await scenario(async (s, tx) => {
      as(s.a)
      const listed = await json(await route.GET(request("GET", "/api/notifications")))
      expect(JSON.stringify(listed)).not.toContain("B's private notification")
      await route.POST(request("POST", "/api/notifications"))
      const [row] = await tx.select().from(notifications).where(eq(notifications.userId, s.b.id))
      expect(row?.readAt).toBeNull()
    })
  })

  it("taste: A can't read or reset B's signals", async () => {
    const route = await import("@/app/api/taste/route")
    await scenario(async (s, tx) => {
      as(s.a)
      const listed = await json(await route.GET(request("GET", "/api/taste")))
      expect(JSON.stringify(listed)).not.toContain("ken-carson")
      await route.DELETE(request("DELETE", "/api/taste"))
      expect(
        await tx.select().from(tasteSignals).where(eq(tasteSignals.userId, s.b.id)),
      ).toHaveLength(1)
    })
  })

  it("follows: A can't remove B's followers or B's follows", async () => {
    const followers = await import("@/app/api/followers/route")
    const follows = await import("@/app/api/follows/route")
    await scenario(async (s, tx) => {
      as(s.a)
      await followers.DELETE(request("DELETE", "/api/followers", { handle: s.c.handle }))
      await follows.DELETE(request("DELETE", "/api/follows", { handle: s.c.handle }))
      await follows.DELETE(request("DELETE", "/api/follows", { handle: s.b.handle }))
      const edges = await tx
        .select()
        .from(userFollows)
        .where(sql`${userFollows.followerId} = ${s.b.id} or ${userFollows.followeeId} = ${s.b.id}`)
      expect(edges).toHaveLength(2)
    })
  })

  it("push: A can't unsubscribe B's device", async () => {
    const route = await import("@/app/api/push/route")
    await scenario(async (s, tx) => {
      as(s.a)
      await route.DELETE(request("DELETE", "/api/push", { endpoint: PUSH_B }))
      expect(
        await tx.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, PUSH_B)),
      ).toHaveLength(1)
    })
  })

  it("settings: A's changes only touch A", async () => {
    const route = await import("@/app/api/profile/settings/route")
    await scenario(async (s, tx) => {
      as(s.a)
      await route.PUT(request("PUT", "/api/profile/settings", { visibility: "friends" }))
      expect(
        await tx.select().from(profileSettings).where(eq(profileSettings.userId, s.b.id)),
      ).toHaveLength(0)
    })
  })

  it("account: A's export holds nothing of B's, and deleting A leaves B whole", async () => {
    const route = await import("@/app/api/account/route")
    await scenario(async (s, tx) => {
      as(s.a)
      const exported = await (await route.GET()).text()
      expect(exported).not.toContain(s.b.id)
      expect(JSON.stringify(await exportAccount(tx, s.a.id))).not.toContain(s.b.id)

      await deleteAccountData(tx, s.a.id)
      expect(await tx.select().from(profiles).where(eq(profiles.id, s.b.id))).toHaveLength(1)
      expect(await tx.select().from(fits).where(eq(fits.userId, s.b.id))).toHaveLength(1)
      expect(
        await tx
          .select()
          .from(userFollows)
          .where(and(eq(userFollows.followerId, s.c.id))),
      ).toHaveLength(1)
    })
  })

  it("guests can't call any user-scoped route", async () => {
    const reads: Array<[string, (r: Request) => Promise<Response>]> = [
      ["grails", (await import("@/app/api/grails/route")).GET],
      ["notifications", (await import("@/app/api/notifications/route")).GET],
      ["taste", (await import("@/app/api/taste/route")).GET],
      ["account", (await import("@/app/api/account/route")).GET],
      ["profile/settings", (await import("@/app/api/profile/settings/route")).GET],
      ["alerts/prefs", (await import("@/app/api/alerts/prefs/route")).GET],
    ]
    await scenario(async () => {
      as(null)
      for (const [path, read] of reads) {
        expect((await read(request("GET", `/api/${path}`))).status, path).toBe(401)
      }
    })
  })

  /** N reporter accounts, aged and active as asked; returns their ids. */
  async function reporters(
    tx: Database,
    n: number,
    { daysOld, active }: { daysOld: number; active: "posted" | "voted" | false },
  ): Promise<string[]> {
    const tag = randomUUID().replace(/-/g, "").slice(0, 6)
    const ids = Array.from({ length: n }, () => randomUUID())
    const createdAt = new Date(Date.now() - daysOld * 24 * 3600_000)
    await tx
      .insert(profiles)
      .values(ids.map((id, i) => ({ id, handle: `t_r${i}_${tag}`, createdAt })))
    if (active === "posted") {
      await tx
        .insert(fits)
        .values(ids.map((id) => ({ userId: id, imagePath: `${id}/x.webp`, width: 1, height: 1 })))
    }
    if (active === "voted") {
      await tx
        .insert(votes)
        .values(ids.map((id) => ({ targetId: `fit:${tag}`, voter: id, choice: "cop" as const })))
    }
    return ids
  }

  const RULE = { trustedReporters: AUTO_HIDE_REPORTS, minAgeDays: TRUSTED_REPORTER_MIN_AGE_DAYS }
  const statusOf = async (tx: Database, id: string) =>
    (await tx.select({ status: fits.status }).from(fits).where(eq(fits.id, id)))[0]?.status

  it("reports: new accounts can't hide a fit; it goes to the admin queue", async () => {
    await scenario(async (s, tx) => {
      for (const id of await reporters(tx, 5, { daysOld: 0, active: "posted" })) {
        await reportFit(tx, s.bFit, id, "spam", RULE)
      }
      expect(await statusOf(tx, s.bFit)).toBe("visible")
      const queue = await moderationQueue(tx)
      expect(queue.find((f) => f.id === s.bFit)?.reportCount).toBe(5)
    })
  })

  it("reports: old accounts that never posted or voted can't hide a fit", async () => {
    await scenario(async (s, tx) => {
      for (const id of await reporters(tx, 4, { daysOld: 30, active: false })) {
        await reportFit(tx, s.bFit, id, "spam", RULE)
      }
      expect(await statusOf(tx, s.bFit)).toBe("visible")
    })
  })

  it("reports: the third trusted reporter hides it (posted or voted both count)", async () => {
    await scenario(async (s, tx) => {
      const [posted1, posted2] = await reporters(tx, 2, { daysOld: 8, active: "posted" })
      const [voted] = await reporters(tx, 1, { daysOld: 8, active: "voted" })
      const [fresh] = await reporters(tx, 1, { daysOld: 1, active: "posted" })
      for (const id of [posted1!, fresh!, posted2!]) {
        expect((await reportFit(tx, s.bFit, id, "spam", RULE)).hidden).toBe(false)
      }
      // The same person reporting twice doesn't count twice.
      expect((await reportFit(tx, s.bFit, posted1!, "spam", RULE)).hidden).toBe(false)
      expect(await statusOf(tx, s.bFit)).toBe("visible")
      expect((await reportFit(tx, s.bFit, voted!, "spam", RULE)).hidden).toBe(true)
      expect(await statusOf(tx, s.bFit)).toBe("hidden")
    })
  })

  it("reports: through the route, a fresh account's report only queues the fit", async () => {
    const report = await import("@/app/api/fits/[id]/report/route")
    await scenario(async (s, tx) => {
      as(s.a) // seeded just now: not trusted yet
      const response = await report.POST(
        request("POST", "/x", { reason: "nudity" }),
        params({ id: s.bFit }),
      )
      expect(response.status).toBe(200)
      expect(await statusOf(tx, s.bFit)).toBe("visible")
      expect((await moderationQueue(tx)).some((f) => f.id === s.bFit)).toBe(true)
    })
  })

  it("deleted accounts: a still-valid token can't post, vote, follow, export or come back", async () => {
    const postFitRoute = await import("@/app/api/fits/route")
    const vote = await import("@/app/api/vote/route")
    const follows = await import("@/app/api/follows/route")
    const account = await import("@/app/api/account/route")
    const profile = await import("@/app/api/profile/route")
    await scenario(async (s, tx) => {
      await deleteAccountData(tx, s.a.id)
      state.deleted.add(s.a.id)
      as(s.a)

      const form = new FormData()
      form.set("photo", new Blob([new Uint8Array(16)], { type: "image/webp" }), "fit.webp")
      form.set("data", "{}")
      const post = new Request(`${ORIGIN}/api/fits`, {
        method: "POST",
        headers: { origin: ORIGIN, "content-length": "1024" },
        body: form,
      })
      expect((await postFitRoute.POST(post)).status, "post a fit").toBe(401)
      expect(
        (await vote.POST(request("POST", "/api/vote", { target: `fit:${s.bFit}`, choice: "cop" })))
          .status,
        "vote",
      ).toBe(401)
      expect(
        (await follows.POST(request("POST", "/api/follows", { handle: s.b.handle }))).status,
        "follow",
      ).toBe(401)
      expect((await account.GET()).status, "export").toBe(401)
      expect(
        (
          await profile.POST(
            request("POST", "/api/profile", { handle: "t_back_again", ageConfirmed: true }),
          )
        ).status,
        "claim a handle again",
      ).toBe(401)

      expect(await tx.select().from(votes).where(eq(votes.voter, s.a.id))).toHaveLength(0)
      expect(
        await tx.select().from(userFollows).where(eq(userFollows.followerId, s.a.id)),
      ).toHaveLength(0)
      expect(await tx.select().from(profiles).where(eq(profiles.id, s.a.id))).toHaveLength(0)
    })
  })

  it("deleted accounts: a new account without a handle is still welcome", async () => {
    const follows = await import("@/app/api/follows/route")
    const vote = await import("@/app/api/vote/route")
    await scenario(async (s) => {
      const newcomer = { id: randomUUID(), email: null }
      as(newcomer) // signed in, exists in Auth, no profile yet
      expect(
        (await follows.POST(request("POST", "/api/follows", { handle: s.b.handle }))).status,
      ).toBe(409) // "pick a handle first", not "account gone"
      expect(
        (await vote.POST(request("POST", "/api/vote", { target: `fit:${s.bFit}`, choice: "cop" })))
          .status,
      ).toBe(200)
    })
  })

  it("deleting an account signs out every session before removing the sign-in", async () => {
    const account = await import("@/app/api/account/route")
    await scenario(async (s, tx) => {
      const calls: string[] = []
      state.admin = {
        storage: { from: () => ({ remove: async () => ({ error: null }) }) },
        auth: {
          admin: {
            signOut: vi.fn(async (jwt: string, scope: string) => {
              calls.push(`signOut ${jwt} ${scope}`)
              return { error: null }
            }),
            deleteUser: vi.fn(async (id: string) => {
              calls.push(`deleteUser ${id}`)
              return { error: null }
            }),
          },
        },
      }
      as(s.a)
      const response = await account.DELETE(
        request("DELETE", "/api/account", { confirm: `@${s.a.handle}` }),
      )
      expect(response.status).toBe(200)
      expect(calls).toEqual([`signOut token-of-${s.a.id} global`, `deleteUser ${s.a.id}`])
      expect(await tx.select().from(profiles).where(eq(profiles.id, s.a.id))).toHaveLength(0)
      expect(await tx.select().from(profiles).where(eq(profiles.id, s.b.id))).toHaveLength(1)
    })
  })

  /** What someone with the publishable key (and maybe their own JWT) gets from the Data API. */
  async function asRole(
    tx: Database,
    role: "anon" | "authenticated",
    userId: string | null,
    query: string,
  ): Promise<{ rows: number } | { denied: string }> {
    await tx.execute(sql.raw("savepoint attempt"))
    try {
      await tx.execute(sql.raw(`set local role ${role}`))
      if (userId) {
        const claims = JSON.stringify({ sub: userId, role })
        await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`)
      }
      const result = await tx.execute(sql.raw(query))
      return { rows: (result as unknown as unknown[]).length }
    } catch (error) {
      return { denied: error instanceof Error ? error.message : String(error) }
    } finally {
      await tx.execute(sql.raw("rollback to savepoint attempt"))
    }
  }

  it("direct database access: anon and signed-in roles read and write nothing", async () => {
    await scenario(async (s, tx) => {
      const tables = (await tx.execute(
        sql`select tablename from pg_tables where schemaname = 'public' order by 1`,
      )) as unknown as Array<{ tablename: string }>
      expect(tables.length).toBeGreaterThan(10)

      for (const { tablename } of tables) {
        if (tablename === "niches") continue // public by design: active niches only
        for (const [role, user] of [
          ["anon", null],
          ["authenticated", s.a.id],
        ] as const) {
          const read = await asRole(tx, role, user, `select * from public."${tablename}"`)
          if ("rows" in read) expect(read.rows, `${role} reads ${tablename}`).toBe(0)
        }
      }

      const writes = [
        `insert into public.fits (user_id, image_path, width, height) values ('${s.a.id}', 'x', 1, 1)`,
        `update public.fits set caption = 'pwned' where id = '${s.bFit}'`,
        `delete from public.fits where id = '${s.bFit}'`,
        `update public.profiles set handle = 'pwned' where id = '${s.b.id}'`,
        `insert into public.user_follows (follower_id, followee_id) values ('${s.a.id}', '${s.b.id}')`,
        `delete from public.grail_searches where id = '${s.bGrail}'`,
        `update public.niches set status = 'archived'`,
      ]
      for (const statement of writes) {
        const result = await asRole(tx, "authenticated", s.a.id, `${statement} returning 1`)
        if ("rows" in result) expect(result.rows, statement).toBe(0)
      }
      expect(await tx.select().from(fits).where(eq(fits.id, s.bFit))).toHaveLength(1)

      // Niches: only active ones are visible.
      const hidden = await asRole(
        tx,
        "anon",
        null,
        "select 1 from public.niches where status <> 'active'",
      )
      if ("rows" in hidden) expect(hidden.rows).toBe(0)
    })
  })
})
