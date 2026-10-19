import { connection } from "next/server"
import { ExternalChips } from "@/components/ds/external-chips"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { social } from "@/lib/links"
import { getMoodboard } from "@/lib/moodboard/server"
import { dedupeImages } from "@/lib/images/curate"
import { imageFactsFor } from "@/lib/images/facts-server"
import { MoodboardBoard } from "./moodboard-board"

const PINS_MEASURED = 60
const PINS_BUDGET_MS = 2000

/** Moodboard tab: interactive palette, vibe words, the visual board; other sites as small chips. */
export async function LiveMoodboard({ profile }: { profile: NicheProfile }) {
  await connection()
  const board = await getMoodboard(profile.slug)
  // The same picture is often pinned to several channels: show it once.
  const facts = await imageFactsFor(
    board.pins.map((pin) => pin.imageUrl).slice(0, PINS_MEASURED),
    PINS_BUDGET_MS,
  )
  const pins = dedupeImages(board.pins, (pin) => pin.imageUrl, facts)
  return (
    <div className="space-y-10">
      <MoodboardBoard
        slug={profile.slug}
        palette={profile.palette}
        vibeWords={profile.vibeWords}
        pins={pins}
        pinterestQueries={profile.pinterestQueries}
      />
      <ExternalChips
        label="Keep digging"
        links={[
          ...profile.pinterestQueries.map((query) => ({
            title: query,
            href: social.pinterest(query),
            site: "Pinterest",
          })),
          ...profile.instagramHashtags.map((tag) => ({
            title: `#${tag}`,
            href: social.instagramTag(tag),
            site: "Instagram",
          })),
          ...profile.tiktokQueries.map((query) => ({
            title: query,
            href: social.tiktok(query),
            site: "TikTok",
          })),
        ]}
      />
    </div>
  )
}
