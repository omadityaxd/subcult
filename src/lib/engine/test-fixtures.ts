import type Anthropic from "@anthropic-ai/sdk"
import type { NicheProfileDraft } from "./profile-schema"

/** A schema-valid draft for tests (synthetic data). */
export function makeDraft(overrides: Partial<NicheProfileDraft> = {}): NicheProfileDraft {
  return {
    name: "gorpcore",
    emoji: "🏔️",
    tagline: "dressed for a summit, headed to the bodega",
    description:
      "Technical outdoor gear worn as everyday streetwear. Fleece, shells and trail runners, whether or not a trail is involved.",
    palette: ["#1f2a24", "#3a5a40", "#a3b18a", "#dad7cd", "#f2efe6"],
    vibeWords: ["technical", "earthy", "utilitarian", "layered", "outdoorsy"],
    artists: Array.from({ length: 8 }, (_, i) => ({ name: `artist ${i}`, why: "fits the trail" })),
    spotifyQueries: ["gorpcore playlist", "hiking indie folk", "trail mix chill"],
    subreddits: ["gorpcore", "outdoorgear"],
    newsQueries: ["gorpcore trend", "arc'teryx streetwear"],
    youtubeQueries: ["gorpcore outfit", "gorpcore haul", "best fleece jackets"],
    brands: Array.from({ length: 4 }, (_, i) => ({
      name: `brand ${i}`,
      priceTier: "$$" as const,
      why: "technical outerwear",
    })),
    shopKeywords: ["fleece jacket", "trail runners", "nylon shell", "cargo pants", "bucket hat"],
    pinterestQueries: ["gorpcore outfit", "gorpcore aesthetic"],
    instagramHashtags: ["gorpcore", "outdoorstyle", "techwear"],
    tiktokQueries: ["gorpcore", "gorpcore fit check"],
    relatedNiches: ["techwear", "normcore", "granola girl"],
    ...overrides,
  }
}

type FakeMessageOptions = {
  stopReason?: Anthropic.Message["stop_reason"]
  inputTokens?: number
  outputTokens?: number
}

export function fakeMessage(text: string, options: FakeMessageOptions = {}): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [{ type: "text", text, citations: null }],
    stop_reason: options.stopReason ?? "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: options.inputTokens ?? 1000,
      output_tokens: options.outputTokens ?? 2000,
    },
  } as Anthropic.Message
}

export const okJson = (draft: unknown = makeDraft()) =>
  JSON.stringify({ status: "ok", rejectionReason: null, profile: draft })
