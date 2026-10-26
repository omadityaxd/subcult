import { isExcludedContent } from "@/lib/feed/excluded"
import { z } from "zod"
import { TAXONOMY, findPreset } from "@/lib/niches/catalog"
import { REPORT_REASONS } from "./report-reasons"

/** What a fit post may carry. Everything is validated server-side; the form only helps. */
export const FIT_LIMITS = {
  caption: 280,
  niches: 3,
  brands: 5,
  pieces: 8,
  pieceLabel: 60,
} as const

export const HANDLE = /^[a-z0-9._]{3,24}$/

/** Names that would read as official (compared without dots/underscores). */
const RESERVED_HANDLES = new Set([
  "admin",
  "administrator",
  "subcult",
  "support",
  "help",
  "moderator",
  "mod",
  "staff",
  "official",
  "team",
  "security",
  "root",
  "system",
])

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(HANDLE, "3-24 characters: letters, numbers, dots and underscores")
  .refine((handle) => !/^[._]|[._]$|\.\./.test(handle), "No dots or underscores at the ends, no ..")
  .refine((handle) => !RESERVED_HANDLES.has(handle.replace(/[._]/g, "")), "That handle is reserved")

const PREVIEW_HOSTS = /^https:\/\/[a-z0-9-]+\.(?:mzstatic\.com|itunes\.apple\.com)\//
const SPOTIFY_LINK = /^https:\/\/open\.spotify\.com\//
const URL_MAX = 600

/** The soundtrack sticker: a song from our catalog (iTunes preview + its links). */
export const fitSongSchema = z.object({
  title: z.string().min(1).max(200),
  artist: z.string().min(1).max(200),
  previewUrl: z.string().max(URL_MAX).url().regex(PREVIEW_HOSTS, "previews come from our catalog"),
  // Shown to every viewer: only our catalog's hosts (no tracking pixels, no odd links).
  artworkUrl: z.string().max(URL_MAX).url().regex(PREVIEW_HOSTS).nullable(),
  spotifyUrl: z.string().max(URL_MAX).url().regex(SPOTIFY_LINK).nullable(),
})

export const fitInputSchema = z.object({
  caption: z
    .string()
    .trim()
    .max(FIT_LIMITS.caption)
    .refine((text) => !isExcludedContent(text, { glowUp: true }), "that caption isn't allowed here")
    .optional()
    .default(""),
  niches: z
    .array(z.string())
    .max(FIT_LIMITS.niches)
    .refine((slugs) => slugs.every((slug) => findPreset(slug)), "unknown niche"),
  brands: z
    .array(z.string())
    .max(FIT_LIMITS.brands)
    .refine((slugs) => slugs.every((slug) => TAXONOMY.brand(slug)), "unknown brand"),
  pieces: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(FIT_LIMITS.pieceLabel),
        brand: z
          .string()
          .nullable()
          .default(null)
          .refine((slug) => slug === null || TAXONOMY.brand(slug) !== undefined, "unknown brand"),
      }),
    )
    .max(FIT_LIMITS.pieces),
  song: fitSongSchema.nullable().default(null),
})

export type FitInput = z.infer<typeof fitInputSchema>

export { REPORT_REASONS }
export const reportSchema = z.object({ reason: z.enum(REPORT_REASONS) })

/**
 * Every report lands in the /admin/fits queue. A fit is hidden automatically
 * only once this many different trusted reporters flag it (admins can restore it).
 */
export const AUTO_HIDE_REPORTS = 3
/**
 * A trusted reporter's account is at least this old and has posted a fit or
 * voted, so a handful of fresh sign-ups can't take anyone's fit down.
 */
export const TRUSTED_REPORTER_MIN_AGE_DAYS = 7
