import type Anthropic from "@anthropic-ai/sdk"
import { describe, expect, it } from "vitest"
import {
  DEFAULT_REJECTION,
  type LlmClient,
  generateNicheProfile,
  normalizeRawOutput,
} from "./generate"
import { fakeMessage, makeDraft, okJson } from "./test-fixtures"

/** Fake LLM that returns scripted responses in order and records requests. */
function scriptedLlm(responses: Anthropic.Message[]) {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = []
  const llm: LlmClient = {
    async createMessage(params) {
      calls.push(params)
      const next = responses[calls.length - 1]
      if (!next) throw new Error("no scripted response left")
      return next
    },
  }
  return { llm, calls }
}

const niche = { name: "gorpcore", slug: "gorpcore" }

describe("generateNicheProfile", () => {
  it("returns a validated profile with slug, version and usage", async () => {
    const { llm, calls } = scriptedLlm([fakeMessage(okJson())])

    const result = await generateNicheProfile(niche, { llm })

    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.profile.slug).toBe("gorpcore")
    expect(result.profile.schemaVersion).toBe(1)
    expect(result.stats).toMatchObject({
      model: "claude-haiku-5-5",
      attempts: 1,
      usage: { inputTokens: 1000, outputTokens: 2000 },
    })
    expect(result.stats.costUsd).toBeCloseTo(0.0011, 6)
    expect(calls[0].messages[0].content).toBe("<niche>gorpcore</niche>")
  })

  it("retries once with the validation errors fed back, then succeeds", async () => {
    const broken = okJson(makeDraft({ palette: ["#fff"] }))
    const { llm, calls } = scriptedLlm([fakeMessage(broken), fakeMessage(okJson())])

    const result = await generateNicheProfile(niche, { llm })

    expect(result.status).toBe("ok")
    expect(result.stats.attempts).toBe(2)
    expect(result.stats.usage).toEqual({ inputTokens: 2000, outputTokens: 4000 })
    const repair = calls[1].messages
    expect(repair).toHaveLength(3)
    expect(repair[1].role).toBe("assistant")
    expect(String(repair[2].content)).toMatch(/palette/)
  })

  it("gives up after the repair attempt also fails", async () => {
    const broken = fakeMessage("not json at all")
    const { llm, calls } = scriptedLlm([broken, broken])

    const result = await generateNicheProfile(niche, { llm })

    expect(result.status).toBe("invalid")
    expect(calls).toHaveLength(2)
  })

  it("passes through the model's friendly rejection", async () => {
    const rejection = JSON.stringify({
      status: "rejected",
      rejectionReason: "that's a sandwich, not a scene 🥪",
      profile: null,
    })
    const { llm } = scriptedLlm([fakeMessage(rejection)])

    const result = await generateNicheProfile({ name: "blt", slug: "blt" }, { llm })

    expect(result).toMatchObject({
      status: "rejected",
      reason: "that's a sandwich, not a scene 🥪",
    })
  })

  it("treats a safety refusal as a rejection without retrying", async () => {
    const { llm, calls } = scriptedLlm([fakeMessage("", { stopReason: "refusal" })])

    const result = await generateNicheProfile(niche, { llm })

    expect(result).toMatchObject({ status: "rejected", reason: DEFAULT_REJECTION })
    expect(calls).toHaveLength(1)
  })

  it("flags ok-without-profile as invalid", async () => {
    const odd = JSON.stringify({ status: "ok", rejectionReason: null, profile: null })
    const { llm } = scriptedLlm([fakeMessage(odd), fakeMessage(odd)])

    const result = await generateNicheProfile(niche, { llm })

    expect(result.status).toBe("invalid")
  })

  it("propagates API errors to the caller", async () => {
    const llm: LlmClient = {
      createMessage: async () => {
        throw new Error("overloaded")
      },
    }
    await expect(generateNicheProfile(niche, { llm })).rejects.toThrow("overloaded")
  })
})

describe("normalizeRawOutput", () => {
  it("strips r/ and # prefixes and lowercases hex", () => {
    const raw = {
      status: "ok",
      profile: {
        subreddits: ["r/gorpcore", "/r/hiking"],
        instagramHashtags: ["#gorp"],
        palette: ["#ABCDEF"],
      },
    }
    expect(normalizeRawOutput(raw)).toEqual({
      status: "ok",
      profile: {
        subreddits: ["gorpcore", "hiking"],
        instagramHashtags: ["gorp"],
        palette: ["#abcdef"],
      },
    })
  })
})
