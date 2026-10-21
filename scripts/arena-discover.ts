/**
 * pnpm arena:discover [slug …] [--write]
 *
 * Finds public Are.na channels for each niche (searched by its name, top
 * brands and "fits"), then checks each candidate's actual contents: enough
 * image blocks, and a title that names the scene. Prints the shortlist;
 * --write adds the top two per niche to data/taxonomy/niches.json. Vision
 * tagging later decides fit vs moodboard per image.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { loadLocalEnv } from "./load-env"

const MIN_BLOCKS = 40
const MIN_IMAGE_SHARE = 0.7
const PER_NICHE = 2
const FASHION_WORDS = /\b(fashion|fits?|outfits?|style|wear|clothing|archive)\b/
const UA = { "User-Agent": "subcult/1.0 (niche discovery app)" }

interface ArenaChannel {
  slug: string
  title: string
  length: number
  status: string
  published: boolean
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Are.na rate-limits search hard: one query every 2s, backing off on 429. */
async function search(q: string, attempt = 0): Promise<ArenaChannel[]> {
  await sleep(2000)
  const res = await fetch(
    `https://api.are.na/v2/search/channels?q=${encodeURIComponent(q)}&per=10`,
    {
      headers: UA,
      signal: AbortSignal.timeout(10_000),
    },
  )
  if (res.status === 429 && attempt < 3) {
    await sleep(30_000 * (attempt + 1))
    return search(q, attempt + 1)
  }
  if (!res.ok) return []
  const body = (await res.json()) as { channels?: ArenaChannel[] }
  return body.channels ?? []
}

/** Share of image blocks in the channel's first page (v3 contents, like the app reads). */
async function imageShare(slug: string): Promise<number> {
  const res = await fetch(
    `https://api.are.na/v3/channels/${encodeURIComponent(slug)}/contents?per=40`,
    {
      headers: UA,
      signal: AbortSignal.timeout(10_000),
    },
  )
  if (!res.ok) return 0
  const body = (await res.json()) as { data?: { type: string }[] }
  const blocks = body.data ?? []
  return blocks.length === 0 ? 0 : blocks.filter((b) => b.type === "Image").length / blocks.length
}

const words = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]+/g, " ")

async function main(): Promise<void> {
  loadLocalEnv()
  const { SEED_PROFILES, TAXONOMY } = await import("../src/lib/niches/catalog")
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"))
  const write = process.argv.includes("--write")
  const featured = new Set(TAXONOMY.featured())
  const profiles = SEED_PROFILES.filter((p) =>
    args.length ? args.includes(p.slug) : featured.has(p.slug),
  )
  const picks: Record<string, string[]> = {}
  for (const profile of profiles) {
    const brands = TAXONOMY.brandsOf(profile.slug).map((b) => b.name)
    const queries = [...new Set([profile.name, `${profile.name} fits`, ...brands.slice(0, 3)])]
    const seen = new Set<string>()
    const candidates: (ArenaChannel & { share: number })[] = []
    for (const q of queries) {
      for (const channel of await search(q)) {
        if (seen.has(channel.slug)) continue
        seen.add(channel.slug)
        if (!channel.published || channel.status === "private" || channel.length < MIN_BLOCKS)
          continue
        const title = words(channel.title)
        // A one-word niche name ("rage") must come with a fashion word; brand names stand alone.
        const nicheHit =
          title.includes(words(profile.name).trim()) &&
          (profile.name.includes(" ") || FASHION_WORDS.test(title))
        const brandHit = brands.slice(0, 3).some((name) => title.includes(words(name).trim()))
        if (!nicheHit && !brandHit) continue
        const share = await imageShare(channel.slug)
        if (share >= MIN_IMAGE_SHARE) candidates.push({ ...channel, share })
      }
    }
    candidates.sort((a, b) => b.length * b.share - a.length * a.share)
    picks[profile.slug] = candidates.slice(0, PER_NICHE).map((c) => c.slug)
    console.log(
      `${profile.slug.padEnd(30)} ${
        candidates.length
          ? candidates
              .slice(0, PER_NICHE)
              .map(
                (c) =>
                  `${c.slug} ("${c.title}", ${c.length} blocks, ${Math.round(c.share * 100)}% images)`,
              )
              .join("; ")
          : "none found"
      }`,
    )
  }
  if (write) {
    const path = "data/taxonomy/niches.json"
    const curation = JSON.parse(readFileSync(path, "utf8")) as {
      slug: string
      arenaChannels?: string[]
    }[]
    for (const entry of curation) {
      const found = picks[entry.slug]
      if (!found?.length) continue
      entry.arenaChannels = [...new Set([...(entry.arenaChannels ?? []), ...found])]
    }
    writeFileSync(path, `${JSON.stringify(curation, null, 2)}\n`)
    console.log(
      `\nwrote channels for ${Object.values(picks).filter((p) => p.length).length} niches`,
    )
  }
  process.exit(0)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
