import { describe, expect, it } from "vitest"
import { checkServices, doctorFails, formatTable } from "./services"

const REQUIRED = {
  DATABASE_URL: "postgres://x",
  NEXT_PUBLIC_SUPABASE_URL: "https://p.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  UPSTASH_REDIS_REST_URL: "https://r.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "t",
}

/** A fetch that answers every URL with the given status, recording what was called. */
function fakeFetch(statusFor: (url: string) => number) {
  const calls: string[] = []
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    return new Response("{}", { status: statusFor(url) })
  }) as typeof fetch
  return { impl, calls }
}

const dbUp = { database: async () => ({ reachable: true, detail: "select 1" }) }

describe("checkServices", () => {
  it("turns a feature on when its keys are present and the ping works", async () => {
    const { impl } = fakeFetch(() => 200)
    const rows = await checkServices(
      { ...REQUIRED, EBAY_CLIENT_ID: "id", EBAY_CLIENT_SECRET: "secret" },
      { fetchImpl: impl, extraProbes: dbUp },
    )
    const ebay = rows.find((r) => r.id === "ebay")
    expect(ebay).toMatchObject({ present: true, reachable: true, on: true })
    expect(doctorFails(rows)).toBe(false)
  })

  it("leaves a feature off without keys, and never pings it", async () => {
    const { impl, calls } = fakeFetch(() => 200)
    const rows = await checkServices(REQUIRED, { fetchImpl: impl, extraProbes: dbUp })
    expect(rows.find((r) => r.id === "ebay")).toMatchObject({
      present: false,
      on: false,
      missing: ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"],
    })
    expect(calls.some((url) => url.includes("ebay.com"))).toBe(false)
  })

  it("marks a present but rejected key as broken, without failing the doctor (optional)", async () => {
    const { impl } = fakeFetch((url) => (url.includes("ebay.com") ? 401 : 200))
    const rows = await checkServices(
      { ...REQUIRED, EBAY_CLIENT_ID: "id", EBAY_CLIENT_SECRET: "bad" },
      { fetchImpl: impl, extraProbes: dbUp },
    )
    expect(rows.find((r) => r.id === "ebay")).toMatchObject({ reachable: false, on: false })
    expect(doctorFails(rows)).toBe(false)
  })

  it("fails the doctor when a required service is missing or broken", async () => {
    const { impl } = fakeFetch((url) => (url.includes("upstash") ? 500 : 200))
    expect(doctorFails(await checkServices(REQUIRED, { fetchImpl: impl, extraProbes: dbUp }))).toBe(
      true,
    )
    const noDb = { ...REQUIRED, DATABASE_URL: undefined }
    expect(doctorFails(await checkServices(noDb, { fetchImpl: fakeFetch(() => 200).impl }))).toBe(
      true,
    )
  })

  it("survives a ping that throws, and prints a readable table", async () => {
    const impl = (async () => {
      throw new Error("network down")
    }) as typeof fetch
    const rows = await checkServices(REQUIRED, { fetchImpl: impl, extraProbes: dbUp })
    expect(rows.find((r) => r.id === "redis")).toMatchObject({
      reachable: false,
      detail: "network down",
    })
    expect(formatTable(rows)).toContain("Upstash Redis *")
  })
})
