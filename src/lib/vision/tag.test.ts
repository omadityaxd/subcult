import type Anthropic from "@anthropic-ai/sdk"
import { describe, expect, it } from "vitest"
import type { LlmClient } from "@/lib/engine/generate"
import {
  type VisionTag,
  belongsInFeed,
  canBeCover,
  isVerifiedFit,
  parseVisionOutput,
  tagImageBatch,
} from "./tag"

const tag = (over: Partial<VisionTag>): VisionTag => ({
  kind: "fit",
  quality: 4,
  nicheFit: 0.9,
  colors: ["#111111"],
  ...over,
})

const NICHE = { name: "jerk", description: "Skinny jeans, studded belts, rage-adjacent rap." }

function fakeLlm(reply: Partial<Anthropic.Message> | Error): LlmClient & {
  calls: Anthropic.MessageCreateParamsNonStreaming[]
} {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = []
  return {
    calls,
    async createMessage(params) {
      calls.push(params)
      if (reply instanceof Error) throw reply
      return {
        stop_reason: "end_turn",
        content: [],
        usage: { input_tokens: 3000, output_tokens: 200 },
        ...reply,
      } as Anthropic.Message
    },
  }
}

const textReply = (json: unknown): Partial<Anthropic.Message> => ({
  content: [{ type: "text", text: JSON.stringify(json), citations: null }],
})

describe("vision rules", () => {
  it("only a decent photo of an outfit is a verified fit", () => {
    expect(isVerifiedFit(tag({}))).toBe(true)
    expect(isVerifiedFit(tag({ quality: 2 }))).toBe(false)
    expect(isVerifiedFit(tag({ kind: "moodboard" }))).toBe(false)
    expect(isVerifiedFit(null)).toBe(false)
  })

  it("quality under 3 is never a cover", () => {
    expect(canBeCover(tag({ quality: 3 }))).toBe(true)
    expect(canBeCover(tag({ quality: 2 }))).toBe(false)
    expect(canBeCover(undefined)).toBe(false)
  })

  it("feeds take fits, products and moodboard shots that are on-topic", () => {
    expect(belongsInFeed(tag({ kind: "product" }))).toBe(true)
    expect(belongsInFeed(tag({ kind: "moodboard" }))).toBe(true)
    expect(belongsInFeed(tag({ kind: "album-art" }))).toBe(false)
    expect(belongsInFeed(tag({ kind: "other" }))).toBe(false)
    expect(belongsInFeed(tag({ nicheFit: 0.3 }))).toBe(false)
    expect(belongsInFeed(null)).toBe(false)
  })
})

describe("parseVisionOutput", () => {
  it("returns tags in input order and ignores bad indexes", () => {
    const text = JSON.stringify({
      images: [
        { index: 1, ...tag({ kind: "product" }) },
        { index: 0, ...tag({}) },
        { index: 7, ...tag({}) },
      ],
    })
    const tags = parseVisionOutput(text, 3)
    expect(tags?.map((t) => t?.kind ?? null)).toEqual(["fit", "product", null])
  })

  it("rejects malformed output", () => {
    expect(parseVisionOutput("not json", 1)).toBeNull()
    expect(parseVisionOutput(JSON.stringify({ images: [{ index: 0, kind: "x" }] }), 1)).toBeNull()
  })
})

describe("tagImageBatch", () => {
  it("sends every image as a URL block and prices the call", async () => {
    const llm = fakeLlm(textReply({ images: [{ index: 0, ...tag({}) }] }))
    const result = await tagImageBatch(
      llm,
      [{ url: "https://img/a.jpg" }, { url: "https://img/b.jpg" }],
      NICHE,
    )
    const [params] = llm.calls
    const content = params.messages[0].content as Anthropic.ContentBlockParam[]
    expect(content.filter((block) => block.type === "image")).toHaveLength(2)
    expect(params.model).toBe("claude-haiku-5-5")
    expect(result.status).toBe("ok")
    expect(result.tags.map((t) => t?.kind ?? null)).toEqual(["fit", null])
    // 3000 in × $0.10/M + 200 out × $0.50/M
    expect(result.costUsd).toBeCloseTo(0.0004, 6)
  })

  it("never throws: an API error leaves every image untagged", async () => {
    const result = await tagImageBatch(
      fakeLlm(new Error("boom")),
      [{ url: "https://img/a.jpg" }],
      NICHE,
    )
    expect(result).toMatchObject({ status: "error", tags: [null], costUsd: 0 })
  })

  it("treats a refusal or cut-off reply as invalid", async () => {
    const llm = fakeLlm({ ...textReply({ images: [] }), stop_reason: "refusal" })
    const result = await tagImageBatch(llm, [{ url: "https://img/a.jpg" }], NICHE)
    expect(result.status).toBe("invalid")
    expect(result.tags).toEqual([null])
  })

  it("makes no call for an empty batch", async () => {
    const llm = fakeLlm(textReply({ images: [] }))
    await tagImageBatch(llm, [], NICHE)
    expect(llm.calls).toHaveLength(0)
  })
})
