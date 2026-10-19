import "server-only"
import { randomUUID } from "node:crypto"
import { getDb } from "@/db"
import {
  type FitWithAuthor,
  getProfile,
  insertFit,
  listFits,
  savedFits,
  viewerState,
} from "@/db/fit-repository"
import { env } from "@/lib/env"
import type { FeedItem } from "@/lib/feed/types"
import { errorMessage, log } from "@/lib/log"
import { TAXONOMY, findPreset } from "@/lib/niches/catalog"
import { getStorageAdmin } from "@/lib/supabase/admin"
import { type Viewer, getViewer } from "@/lib/supabase/server"
import { notifyFollowersOfFit } from "@/lib/social/notify"
import { processFitImage } from "./image"
import type { FitInput } from "./schema"
import type { FitView } from "./types"

export const FITS_BUCKET = "fits"

export const publicImageUrl = (path: string) =>
  `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${FITS_BUCKET}/${path}`

/** Rows → client views, with the viewer's like/save state. */
export async function toViews(
  rows: readonly FitWithAuthor[],
  viewer: Viewer | null,
): Promise<FitView[]> {
  const db = getDb()
  const state =
    db && viewer
      ? await viewerState(
          db,
          viewer.id,
          rows.map((row) => row.id),
        )
      : null
  return rows.map((row) => ({
    id: row.id,
    handle: row.handle,
    imageUrl: publicImageUrl(row.imagePath),
    width: row.width,
    height: row.height,
    caption: row.caption,
    niches: row.niches.flatMap((slug) => {
      const preset = findPreset(slug)
      return preset ? [{ slug, name: preset.name }] : []
    }),
    brands: row.brands.flatMap((slug) => {
      const brand = TAXONOMY.brand(slug)
      return brand ? [{ slug, name: brand.name }] : []
    }),
    pieces: row.pieces,
    song: row.song,
    likeCount: row.likeCount,
    createdAt: row.createdAt.toISOString(),
    liked: state?.liked.has(row.id) ?? false,
    saved: state?.saved.has(row.id) ?? false,
    mine: viewer?.id === row.userId,
  }))
}

/** Fits for a niche's Fits tab or the For You feed. Empty without a database. */
export async function nicheFits(slug: string, limit = 24): Promise<FitView[]> {
  const db = getDb()
  if (!db) return []
  try {
    const [rows, viewer] = await Promise.all([listFits(db, { niche: slug, limit }), getViewer()])
    return toViews(rows, viewer)
  } catch (error) {
    log.warn("fits.list_failed", { slug, error: errorMessage(error) })
    return []
  }
}

export async function latestFits(limit = 24): Promise<FitView[]> {
  const db = getDb()
  if (!db) return []
  try {
    const [rows, viewer] = await Promise.all([listFits(db, { limit }), getViewer()])
    return toViews(rows, viewer)
  } catch (error) {
    log.warn("fits.latest_failed", { error: errorMessage(error) })
    return []
  }
}

/** The Me page: the viewer's profile, own fits and saved fits. */
export async function myFits(viewer: Viewer) {
  const db = getDb()
  if (!db) return { profile: null, posted: [], saved: [] }
  const [profile, posted, saved] = await Promise.all([
    getProfile(db, viewer.id),
    listFits(db, { userId: viewer.id, limit: 60, includeHidden: true }),
    savedFits(db, viewer.id),
  ])
  return {
    profile,
    posted: await toViews(posted, viewer),
    saved: await toViews(saved, viewer),
  }
}

/** Fits as For You fashion cards. Meta carries what the card and sheet need (primitives only). */
export function fitFeedItems(views: readonly FitView[]): FeedItem[] {
  return views.map((fit) => ({
    id: `fit:${fit.id}`,
    source: "subcult" as const,
    type: "fit" as const,
    title: fit.caption ?? `@${fit.handle}`,
    subtitle: `@${fit.handle}`,
    imageUrl: fit.imageUrl,
    url: `/fits/${fit.id}`,
    publishedAt: fit.createdAt,
    score: 1,
    meta: {
      fitId: fit.id,
      width: fit.width,
      height: fit.height,
      likeCount: fit.likeCount,
      nicheName: fit.niches[0]?.name ?? null,
      brandNames: fit.brands.map((brand) => brand.name).join(", ") || null,
    },
  }))
}

export class FitPostError extends Error {}

/**
 * Posts a fit: the photo is re-encoded here (no EXIF/GPS survives) and only
 * then stored, by the server: users have no write access to Storage at all.
 */
export async function postFit(viewer: Viewer, photo: Uint8Array, input: FitInput): Promise<string> {
  const db = getDb()
  const storage = getStorageAdmin()
  if (!db || !storage) throw new FitPostError("Posting isn't available right now.")
  const profile = await getProfile(db, viewer.id)
  if (!profile) throw new FitPostError("Pick a handle first.")

  const image = await processFitImage(photo)
  const id = randomUUID()
  const path = `${viewer.id}/${id}.webp`
  const { error } = await storage.storage
    .from(FITS_BUCKET)
    .upload(path, image.data, { contentType: "image/webp", upsert: false })
  if (error) {
    log.warn("fits.upload_failed", { error: error.message })
    throw new FitPostError("The photo didn't upload. Try again.")
  }
  await insertFit(db, {
    id,
    userId: viewer.id,
    imagePath: path,
    width: image.width,
    height: image.height,
    caption: input.caption || null,
    niches: input.niches,
    brands: input.brands,
    pieces: input.pieces,
    song: input.song,
  })
  // Friend activity: followers hear about it (best effort; posting never fails on this).
  await notifyFollowersOfFit(viewer.id, profile.handle, id, publicImageUrl(path)).catch(
    (error: unknown) => log.warn("fits.notify_failed", { error: errorMessage(error) }),
  )
  return id
}

export const QUARANTINE_BUCKET = "fits-quarantine"

/**
 * Hiding a fit also takes its photo off the public bucket (moved to a private
 * one), so a hidden image isn't still served to anyone holding the URL.
 */
export async function quarantinePhoto(path: string, hidden: boolean): Promise<void> {
  const storage = getStorageAdmin()
  if (!storage) return
  const [from, to] = hidden ? [FITS_BUCKET, QUARANTINE_BUCKET] : [QUARANTINE_BUCKET, FITS_BUCKET]
  const { error } = await storage.storage.from(from).move(path, path, { destinationBucket: to })
  if (error) log.warn("fits.quarantine_failed", { path, hidden, error: error.message })
}

/** Admin review: hidden fits live in the private bucket, so they get a short-lived signed URL. */
export async function moderationImageUrl(path: string, hidden: boolean): Promise<string | null> {
  if (!hidden) return publicImageUrl(path)
  const { data } =
    (await getStorageAdmin()?.storage.from(QUARANTINE_BUCKET).createSignedUrl(path, 600)) ?? {}
  return data?.signedUrl ?? null
}
