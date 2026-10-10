import type Anthropic from "@anthropic-ai/sdk"
import { describe, expect, it, vi } from "vitest"
import { BLURB_MODEL, generateVibeBlurb, sanitizeBlurb } from "./blurb"
import type { MixNiche } from "./data"

const MIX: MixNiche[] = [
  {
    slug: "rage",
    percent: 60,
    name: "rage",
    tagline: "the synth is screaming",
    palette: [],
    imageUrl: null,
  },
  { slug: "vamp", percent: 40, name: "vamp", tagline: "all black", palette: [], imageUrl: null },
]

const reply = (text: string) =>
  ({
    content: [{ type: "text", text }],
    usage: { input_tokens: 120, output_tokens: 40 },
  }) as unknown as Anthropic.Message

describe("sanitizeBlurb", () => {
  it("strips emoji, wrapping quotes and extra whitespace", () => {
    expect(sanitizeBlurb('"You dress like the mosh pit owes you money.  🔥"')).toBe(
      "You dress like the mosh pit owes you money.",
    )
  })

  it("rejects outputs that are too short or too long", () => {
    expect(sanitizeBlurb("ok")).toBeNull()
    expect(sanitizeBlurb("a".repeat(400))).toBeNull()
  })
})

describe("generateVibeBlurb", () => {
  it("calls Haiku with the mix and returns a clean blurb with its cost", async () => {
    const createMessage = vi.fn<
      (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>
    >(async () =>
      reply("Rage in your headphones, vamp in your closet. Opium would sign you on the spot."),
    )
    const outcome = await generateVibeBlurb({ createMessage }, MIX)
    expect(outcome.status).toBe("ok")
    expect(outcome.text).toMatch(/^Rage in your headphones/)
    expect(outcome.usage).toEqual({ inputTokens: 120, outputTokens: 40 })
    expect(outcome.costUsd).toBeGreaterThan(0)
    const [params] = createMessage.mock.calls[0]
    expect(params.model).toBe(BLURB_MODEL)
    expect(JSON.stringify(params.messages)).toContain("rage (60%)")
  })

  it("reports invalid output so the caller keeps the template", async () => {
    const outcome = await generateVibeBlurb({ createMessage: vi.fn(async () => reply("lol")) }, MIX)
    expect(outcome).toMatchObject({ status: "invalid", text: null })
  })

  it("never throws on API errors", async () => {
    const createMessage = vi.fn(async () => {
      throw new Error("529 overloaded")
    })
    expect(await generateVibeBlurb({ createMessage }, MIX)).toMatchObject({
      status: "error",
      text: null,
    })
  })
})
