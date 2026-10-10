import { describe, expect, it, vi } from "vitest"
import type { Logger } from "@/lib/log"
import type { GenerationResult } from "./generate"
import {
  type NicheGenerator,
  type NicheRepository,
  type StoredNiche,
  createNicheService,
} from "./niche-service"
import { makeDraft } from "./test-fixtures"

const silentLogger: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

const stats = {
  model: "claude-haiku-5-5",
  usage: { inputTokens: 100, outputTokens: 200 },
  attempts: 1,
  costUsd: 0.00011,
  durationMs: 5,
}

function memoryRepo(seed: StoredNiche[] = []): NicheRepository {
  const rows = new Map(seed.map((row) => [row.slug, row]))
  return {
    findBySlug: async (slug) => rows.get(slug) ?? null,
    insert: async (niche) => {
      const existing = rows.get(niche.profile.slug)
      if (existing) return existing
      const row: StoredNiche = {
        slug: niche.profile.slug,
        name: niche.profile.name,
        profile: niche.profile,
        generatedBy: niche.generatedBy,
        createdAt: new Date(0),
      }
      rows.set(row.slug, row)
      return row
    },
    listSlugs: async () => [...rows.keys()],
  }
}

const okGenerator: NicheGenerator = async ({ slug }) => ({
  status: "ok",
  profile: { ...makeDraft(), slug, schemaVersion: 1 },
  stats,
})

describe("nicheService.getOrCreate", () => {
  it("serves cached niches without calling the LLM", async () => {
    const repo = memoryRepo()
    await repo.insert({
      profile: { ...makeDraft(), slug: "gorpcore", schemaVersion: 1 },
      generatedBy: "seed",
      model: "m",
      inputTokens: 0,
      outputTokens: 0,
    })
    const generate = vi.fn(okGenerator)
    const service = createNicheService({ repo, generate, logger: silentLogger })

    const result = await service.getOrCreate("Gorpcore", { generatedBy: "anon" })

    expect(result).toMatchObject({ status: "found", source: "cache" })
    expect(generate).not.toHaveBeenCalled()
  })

  it("generates, stores and logs usage on a cache miss", async () => {
    const repo = memoryRepo()
    const logger: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const service = createNicheService({ repo, generate: okGenerator, logger })

    const result = await service.getOrCreate("jersey club girlies", { generatedBy: "anon" })

    expect(result).toMatchObject({ status: "found", source: "generated" })
    expect(await repo.findBySlug("jersey-club-girlies")).not.toBeNull()
    expect(logger.info).toHaveBeenCalledWith(
      "niche.generate",
      expect.objectContaining({ inputTokens: 100, outputTokens: 200, costUsd: 0.00011 }),
    )
  })

  it("shares one generation between concurrent requests for the same slug", async () => {
    const generate = vi.fn(okGenerator)
    const service = createNicheService({ repo: memoryRepo(), generate, logger: silentLogger })

    const [a, b] = await Promise.all([
      service.getOrCreate("hyperpop", { generatedBy: "anon" }),
      service.getOrCreate("Hyperpop!", { generatedBy: "anon" }),
    ])

    expect(generate).toHaveBeenCalledTimes(1)
    expect(a.status).toBe("found")
    expect(b.status).toBe("found")
  })

  it("checks the rate limit only on a cache miss", async () => {
    const allowGeneration = vi.fn(async () => false)
    const generate = vi.fn(okGenerator)
    const service = createNicheService({ repo: memoryRepo(), generate, logger: silentLogger })

    const result = await service.getOrCreate("new vibe", { generatedBy: "anon", allowGeneration })

    expect(result.status).toBe("rate-limited")
    expect(generate).not.toHaveBeenCalled()
  })

  it.each<[GenerationResult, string]>([
    [{ status: "rejected", reason: "nope", stats }, "rejected"],
    [{ status: "invalid", issues: "bad", stats }, "failed"],
  ])("maps a %s generation to %s", async (generation, expected) => {
    const service = createNicheService({
      repo: memoryRepo(),
      generate: async () => generation,
      logger: silentLogger,
    })
    expect((await service.getOrCreate("some vibe", { generatedBy: "anon" })).status).toBe(expected)
  })

  it("reports failures from the LLM without throwing", async () => {
    const service = createNicheService({
      repo: memoryRepo(),
      generate: async () => {
        throw new Error("529 overloaded")
      },
      logger: silentLogger,
    })
    expect((await service.getOrCreate("some vibe", { generatedBy: "anon" })).status).toBe("failed")
  })

  it("is unavailable without an LLM and rejects bad input early", async () => {
    const service = createNicheService({ repo: memoryRepo(), generate: null, logger: silentLogger })
    expect((await service.getOrCreate("new vibe", { generatedBy: "anon" })).status).toBe(
      "unavailable",
    )
    expect((await service.getOrCreate("!!", { generatedBy: "anon" })).status).toBe("invalid-input")
  })
})
