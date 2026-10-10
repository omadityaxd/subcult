import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import { nicheProfileSchema } from "@/lib/engine/profile-schema"
import { toNicheSlug } from "@/lib/engine/slug"
import { trendSourceSchema } from "@/lib/niches/lifecycle"
import { MIN_CITED_SOURCES } from "./propose"

/**
 * A hand-researched trending niche (written by the /refresh-trends Claude Code
 * command): a full NicheProfile plus the evidence that it's trending.
 */
export const trendFileSchema = nicheProfileSchema
  .extend({
    trendScore: z.number().int().min(0).max(100),
    whyNow: z.string().min(10).max(240),
    sources: z.array(trendSourceSchema).min(MIN_CITED_SOURCES).max(10),
  })
  .refine((file) => file.slug === toNicheSlug(file.name), {
    message: "slug must equal toNicheSlug(name)",
    path: ["slug"],
  })
  .refine(
    (file) => new Set(file.sources.map((source) => source.url)).size === file.sources.length,
    {
      message: "sources must be distinct URLs",
      path: ["sources"],
    },
  )

export type TrendFile = z.infer<typeof trendFileSchema>

export const TREND_DATA_DIR = join(process.cwd(), "data", "trends")

export interface TrendFileResult {
  file: string
  result: z.ZodSafeParseResult<TrendFile>
}

/** Reads and validates every data/trends/*.json file (missing folder = none). */
export function readTrendFiles(dir: string = TREND_DATA_DIR): TrendFileResult[] {
  let files: string[]
  try {
    files = readdirSync(dir).filter((file) => file.endsWith(".json"))
  } catch {
    return []
  }
  return files.map((file) => {
    let raw: unknown
    try {
      raw = JSON.parse(readFileSync(join(dir, file), "utf8"))
    } catch {
      raw = null
    }
    return { file, result: trendFileSchema.safeParse(raw) }
  })
}
