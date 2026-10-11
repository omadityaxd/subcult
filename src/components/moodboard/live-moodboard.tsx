import { connection } from "next/server"
import { ExternalChips } from "@/components/ds/external-chips"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { social } from "@/lib/links"
import { getMoodboard } from "@/lib/moodboard/server"
import { MoodboardBoard } from "./moodboard-board"

/** Moodboard tab: interactive palette, vibe words, the visual board; other sites as small chips. */
export async function LiveMoodboard({ profile }: { profile: NicheProfile }) {
  await connection()
  const board = await getMoodboard(profile.slug)
  return (
    <div className="space-y-10">
      <MoodboardBoard
        slug={profile.slug}
        palette={profile.palette}
        vibeWords={profile.vibeWords}
        pins={board.pins}
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
