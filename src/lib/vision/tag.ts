import type Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"
import type { LlmClient } from "@/lib/engine/generate"
import { type TokenUsage, ZERO_USAGE, estimateCostUsd } from "@/lib/engine/pricing"

/**
 * Vision tagging: what an image actually is, so stock photos and Are.na
 * blocks only land where they belong (a fit under Fits, album art in Sounds,
 * low-quality images never as a cover). Pure apart from the injected client.
 */
export const VISION_MODEL = "claude-haiku-5-5"
export const VISION_KINDS = [
  "fit",
  "product",
  "album-art",
  "artist-portrait",
  "moodboard",
  "other",
] as const
export type VisionKind = (typeof VISION_KINDS)[number]

/** Images per request: small enough that one unreachable URL costs little. */
export const VISION_BATCH = 6
/** Under 3 is never a cover and never in Fits. */
export const MIN_QUALITY = 3
/** Below this the image is off-topic for the niche and stays out of feeds. */
export const MIN_NICHE_FIT = 0.5

const HEX = /^#[0-9a-f]{6}$/

export const visionTagSchema = z.object({
  kind: z.enum(VISION_KINDS),
  /** 1 = blurry/watermarked/meme screenshot … 5 = editorial quality. */
  quality: z.number().int().min(1).max(5),
  /** 0–1: how well the image matches the niche's look. */
  nicheFit: z.number().min(0).max(1),
  /** Up to three dominant colors, lowercase #rrggbb. */
  colors: z.array(z.string().regex(HEX)).max(3),
  /** One-line alt text for screen readers (optional: tags cached before it have none). */
  alt: z.string().max(160).optional(),
})
export type VisionTag = z.infer<typeof visionTagSchema>

const outputSchema = z.object({
  images: z.array(visionTagSchema.extend({ index: z.number().int().min(0) })),
})
const OUTPUT_FORMAT = zodOutputFormat(outputSchema)

/** A real outfit worth showing under Fits. */
export const isVerifiedFit = (tag: VisionTag | null | undefined): boolean =>
  tag?.kind === "fit" && tag.quality >= MIN_QUALITY

/** May lead a board or card as its cover image. */
export const canBeCover = (tag: VisionTag | null | undefined): boolean =>
  (tag?.quality ?? 0) >= MIN_QUALITY

/** An external image earns a feed slot: on-topic, good enough, and a kind the feed shows. */
export function belongsInFeed(tag: VisionTag | null | undefined): boolean {
  if (!tag || tag.quality < MIN_QUALITY || tag.nicheFit < MIN_NICHE_FIT) return false
  return tag.kind === "fit" || tag.kind === "moodboard" || tag.kind === "product"
}

const SYSTEM = [
  "You classify images for a fashion and music subculture app.",
  "For each image, by its index, return:",
  "kind: fit (a person's full or partial outfit is the subject), product (a garment, shoe or accessory without a wearer),",
  "album-art (a record or single cover), artist-portrait (a musician's photo where the face, not the outfit, is the subject),",
  "moodboard (a place, texture, object or graphic that sets the mood), or other (memes, screenshots, text, anything else).",
  "quality 1-5: 1 blurry, watermarked or a screenshot; 3 a clear, decent photo; 5 editorial.",
  "nicheFit 0-1: how well it matches the niche described. colors: up to 3 dominant colors as lowercase #rrggbb.",
  "alt: one plain sentence of alt text for a screen reader (what is shown, e.g. clothes, setting), under 120 characters.",
  "Judge only what is visible. Never guess who a person is, and never name anyone in alt.",
].join(" ")

export interface VisionImage {
  url: string
}

export interface VisionBatchResult {
  /** Same order as the input; null where the model gave no valid tag. */
  tags: (VisionTag | null)[]
  usage: TokenUsage
  costUsd: number | null
  status: "ok" | "invalid" | "error"
}

function prompt(niche: { name: string; description: string }, count: number): string {
  return `Niche: ${niche.name}. ${niche.description}\n\nTag the ${count} images above, indexes 0 to ${count - 1}.`
}

/** Model output → tags in input order, dropping anything out of range or malformed. */
export function parseVisionOutput(text: string, count: number): (VisionTag | null)[] | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  const parsed = outputSchema.safeParse(raw)
  if (!parsed.success) return null
  const tags: (VisionTag | null)[] = Array.from({ length: count }, () => null)
  for (const { index, ...tag } of parsed.data.images) {
    if (index < count && tags[index] === null) tags[index] = tag
  }
  return tags
}

/**
 * One request for up to VISION_BATCH images (URL sources, so nothing is
 * downloaded here). Never throws: failures report status "error" and the
 * images stay untagged, which keeps them out of feeds.
 */
export async function tagImageBatch(
  llm: LlmClient,
  images: readonly VisionImage[],
  niche: { name: string; description: string },
  model = VISION_MODEL,
): Promise<VisionBatchResult> {
  const empty = images.map(() => null)
  if (images.length === 0) return { tags: [], usage: ZERO_USAGE, costUsd: 0, status: "ok" }
  const content: Anthropic.ContentBlockParam[] = [
    ...images.map((image): Anthropic.ImageBlockParam => ({
      type: "image",
      source: { type: "url", url: image.url },
    })),
    { type: "text", text: prompt(niche, images.length) },
  ]
  let response: Anthropic.Message
  try {
    response = await llm.createMessage({
      model,
      max_tokens: 260 * images.length,
      system: SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { format: OUTPUT_FORMAT, effort: "low" },
    })
  } catch {
    return { tags: empty, usage: ZERO_USAGE, costUsd: 0, status: "error" }
  }
  const usage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
  const costUsd = estimateCostUsd(model, usage)
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
  const tags = response.stop_reason === "end_turn" ? parseVisionOutput(text, images.length) : null
  return tags
    ? { tags, usage, costUsd, status: "ok" }
    : { tags: empty, usage, costUsd, status: "invalid" }
}
