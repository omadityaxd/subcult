import "server-only"
import { getDb } from "@/db"
import { listFits } from "@/db/fit-repository"
import { type Relation, canView, createSocialRepository } from "@/db/social-repository"
import { createTasteRepository } from "@/db/taste-repository"
import type { NowPlaying, ProfileVisibility } from "@/db/schema"
import { toViews } from "@/lib/fits/server"
import type { FitView } from "@/lib/fits/types"
import { findPreset } from "@/lib/niches/catalog"
import { getViewer, type Viewer } from "@/lib/supabase/server"
import { entitySlug } from "@/lib/taste/entities"
import { type TasteVector, computeAffinity, topEntities } from "@/lib/taste/model"
import { type VibeMatch, vibeMatch } from "./match"

/** "Currently playing" only means now: older than this, it's not shown. */
const LISTENING_FRESH_MS = 20 * 60_000
const TOP_NICHES = 5

export async function tasteVectorOf(userId: string, now = Date.now()): Promise<TasteVector> {
  const db = getDb()
  if (!db) return new Map()
  return computeAffinity(await createTasteRepository(db).recent(userId, now), now)
}

export interface ProfileView {
  handle: string
  relation: Relation
  visibility: ProfileVisibility
  /** False for a friends-only profile you're not mutual with: only the handle shows. */
  visible: boolean
  counts: { followers: number; following: number }
  fits: FitView[]
  topNiches: { slug: string; name: string }[]
  listening: NowPlaying | null
  /** Only for signed-in viewers looking at someone else they can see. */
  match: VibeMatch | null
  viewerSignedIn: boolean
}

export async function profileView(handle: string, now = Date.now()): Promise<ProfileView | null> {
  const db = getDb()
  if (!db) return null
  const social = createSocialRepository(db)
  const person = await social.byHandle(handle)
  if (!person) return null
  const viewer = await getViewer()
  const [relation, settings, counts] = await Promise.all([
    social.relation(viewer?.id ?? null, person.id),
    social.settings(person.id),
    social.counts(person.id),
  ])
  if (relation.blocked) return null
  const visible = canView(settings.visibility, relation)
  const base = {
    handle: person.handle,
    relation,
    visibility: settings.visibility,
    visible,
    counts,
    viewerSignedIn: viewer !== null,
  }
  if (!visible) return { ...base, fits: [], topNiches: [], listening: null, match: null }

  const [rows, theirTaste] = await Promise.all([
    listFits(db, { userId: person.id, limit: 30 }),
    tasteVectorOf(person.id, now),
  ])
  const fits = await toViews(rows, viewer)
  const topNiches = topEntities(theirTaste, TOP_NICHES, "niche").flatMap((a) => {
    const preset = findPreset(entitySlug(a.entity))
    return preset ? [{ slug: preset.slug, name: preset.name }] : []
  })
  const listening =
    settings.shareListening &&
    settings.listening &&
    settings.listeningAt &&
    now - settings.listeningAt.getTime() < LISTENING_FRESH_MS
      ? settings.listening
      : null
  const match =
    viewer && !relation.self ? vibeMatch(await tasteVectorOf(viewer.id, now), theirTaste) : null
  return { ...base, fits, topNiches, listening, match }
}

const FRIENDS_SCANNED = 20
const FRIEND_DAYS_MS = 7 * 24 * 3600_000
const FRIEND_TOP = 4

export interface FriendsInto {
  entity: string
  label: string
  /** Who's into it (handles), most first. */
  handles: string[]
}

/**
 * "Your friends are into this week": the strongest entities in the last 7
 * days of signals from people you follow whose profiles you can see,
 * ranked by how many friends share them.
 */
export async function friendsInto(viewerId: string, now = Date.now()): Promise<FriendsInto[]> {
  const db = getDb()
  if (!db) return []
  const social = createSocialRepository(db)
  const [following, followers] = await Promise.all([
    social.following(viewerId),
    social.followers(viewerId),
  ])
  const followsMe = new Set(followers.map((p) => p.id))
  const visibility = await social.visibilities(following.map((p) => p.id))
  const visible = following
    .filter((p) => (visibility.get(p.id) ?? "public") === "public" || followsMe.has(p.id))
    .slice(0, FRIENDS_SCANNED)
  const taste = createTasteRepository(db)
  const tally = new Map<string, { label: string; handles: string[]; score: number }>()
  for (const friend of visible) {
    const week = (await taste.recent(friend.id, now)).filter((s) => now - s.at < FRIEND_DAYS_MS)
    for (const a of topEntities(computeAffinity(week, now), FRIEND_TOP)) {
      const entry = tally.get(a.entity) ?? { label: a.label, handles: [], score: 0 }
      entry.handles.push(friend.handle)
      entry.score += a.score
      tally.set(a.entity, entry)
    }
  }
  return [...tally]
    .sort((x, y) => y[1].handles.length - x[1].handles.length || y[1].score - x[1].score)
    .map(([entity, { label, handles }]) => ({ entity, label, handles }))
}

/** The signed-in person's own handle, or null (friends need a handle). */
export async function viewerHandle(viewer: Viewer): Promise<string | null> {
  const db = getDb()
  if (!db) return null
  const { getProfile } = await import("@/db/fit-repository")
  return (await getProfile(db, viewer.id))?.handle ?? null
}
