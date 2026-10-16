/**
 * pnpm friends:preview
 *
 * Seeds two throwaway profiles with taste (jerk kid, archive head), renders
 * their Vibe Match share card to docs/screenshots/friends/, prints the match,
 * and keeps the seed for screenshots until run with --clean.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { loadLocalEnv } from "./load-env"

const A = { id: "00000000-0000-4000-8000-00000000a001", handle: "test.jerkkid" }
const B = { id: "00000000-0000-4000-8000-00000000b002", handle: "test.archivehead" }

async function main(): Promise<void> {
  loadLocalEnv()
  const { getDb } = await import("../src/db")
  const { profiles, tasteSignals, userFollows, profileSettings } = await import("../src/db/schema")
  const { inArray } = await import("drizzle-orm")
  const { createTasteRepository } = await import("../src/db/taste-repository")
  const { computeAffinity } = await import("../src/lib/taste/model")
  const { vibeMatch } = await import("../src/lib/social/match")
  const { renderMatchCard } = await import("../src/lib/social/match-card")
  const db = getDb()
  if (!db) throw new Error("DATABASE_URL not set")
  const ids = [A.id, B.id]
  const clean = async () => {
    await db.delete(tasteSignals).where(inArray(tasteSignals.userId, ids))
    await db.delete(userFollows).where(inArray(userFollows.followerId, ids))
    await db.delete(profileSettings).where(inArray(profileSettings.userId, ids))
    await db.delete(profiles).where(inArray(profiles.id, ids))
  }
  if (process.argv.includes("--clean")) {
    await clean()
    console.log("seed removed")
    process.exit(0)
  }
  await clean()
  const now = Date.now()
  const h = (hours: number) => now - hours * 3600_000
  await db.insert(profiles).values([
    { id: A.id, handle: A.handle },
    { id: B.id, handle: B.handle },
  ])
  const taste = createTasteRepository(db)
  await taste.add(A.id, [
    { kind: "follow", entity: "niche:jerk", label: "jerk", strength: 1, at: h(5) },
    { kind: "play_through", entity: "artist:nettspend", label: "Nettspend", strength: 1, at: h(3) },
    { kind: "save", entity: "brand:rick-owens", label: "Rick Owens", strength: 1, at: h(2) },
    {
      kind: "follow",
      entity: "niche:archive-fashion",
      label: "archive fashion",
      strength: 1,
      at: h(4),
    },
  ])
  await taste.add(B.id, [
    {
      kind: "follow",
      entity: "niche:archive-fashion",
      label: "archive fashion",
      strength: 1,
      at: h(6),
    },
    { kind: "save", entity: "brand:rick-owens", label: "Rick Owens", strength: 1, at: h(5) },
    { kind: "save", entity: "brand:number-nine", label: "Number (N)ine", strength: 1, at: h(4) },
    { kind: "play_through", entity: "artist:nettspend", label: "Nettspend", strength: 1, at: h(3) },
    {
      kind: "play_through",
      entity: "artist:a-ap-rocky",
      label: "A$AP Rocky",
      strength: 1,
      at: h(2),
    },
  ])
  await db.insert(userFollows).values([
    { followerId: A.id, followeeId: B.id },
    { followerId: B.id, followeeId: A.id },
  ])
  const [va, vb] = await Promise.all(
    ids.map(async (id) => computeAffinity(await taste.recent(id, now), now)),
  )
  const match = vibeMatch(va, vb)
  console.log(JSON.stringify(match, null, 2))
  const card = await renderMatchCard(A.handle, B.handle, match)
  mkdirSync("docs/screenshots/friends", { recursive: true })
  writeFileSync(
    "docs/screenshots/friends/match-card-1080x1920.png",
    Buffer.from(await card.arrayBuffer()),
  )
  console.log(
    `card written; profiles /u/${A.handle} and /u/${B.handle} seeded (run --clean to remove)`,
  )
  process.exit(0)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
