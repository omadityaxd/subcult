"use client"

import { Check } from "lucide-react"
import { useState } from "react"
import { SectionHeader } from "@/components/ds/section-header"
import { readableTextColor } from "@/lib/color"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { social } from "@/lib/links"
import { LinkList } from "../link-card"

type MoodboardProfile = Pick<
  NicheProfile,
  "palette" | "vibeWords" | "pinterestQueries" | "instagramHashtags" | "tiktokQueries"
>

const COPIED_RESET_MS = 1500

/** Palette (tap to copy), the vibe in words, and jumps into the visual platforms. */
export function MoodboardSection({ profile }: { profile: MoodboardProfile }) {
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(hex: string) {
    try {
      await navigator.clipboard.writeText(hex)
      setCopied(hex)
      setTimeout(() => setCopied((current) => (current === hex ? null : current)), COPIED_RESET_MS)
    } catch {
      // Clipboard blocked: the hex is still printed on the swatch.
    }
  }

  return (
    <div className="space-y-12">
      <section>
        <SectionHeader overline="Tap to copy" title="Palette" />
        <ul className="flex h-56 overflow-hidden rounded-3xl md:h-72">
          {profile.palette.map((hex) => (
            <li
              key={hex}
              className="flex-1 transition-[flex-grow] duration-300 ease-out hover:flex-[1.6]"
            >
              <button
                type="button"
                onClick={() => copy(hex)}
                aria-label={`Copy ${hex}`}
                className="flex h-full w-full items-end p-3 text-caption font-medium uppercase"
                style={{ backgroundColor: hex, color: readableTextColor(hex) }}
              >
                {copied === hex ? (
                  <Check aria-hidden className="size-4" strokeWidth={2} />
                ) : (
                  hex.slice(1)
                )}
              </button>
            </li>
          ))}
        </ul>
        <p aria-live="polite" className="mt-2 h-5 text-footnote text-muted-foreground">
          {copied ? `Copied ${copied}` : ""}
        </p>
      </section>

      <section aria-label="Vibe words">
        <p className="font-serif text-title-1 leading-tight text-balance italic">
          {profile.vibeWords.map((word, index) => (
            <span key={word}>
              <span className={index % 3 === 0 ? "text-niche" : undefined}>{word}</span>
              {index < profile.vibeWords.length - 1 ? (
                <span className="text-subtle"> · </span>
              ) : null}
            </span>
          ))}
        </p>
      </section>

      <section>
        <SectionHeader title="Go deeper" />
        <LinkList
          links={[
            ...profile.pinterestQueries.map((query) => ({
              title: query,
              href: social.pinterest(query),
              meta: "Pinterest",
            })),
            ...profile.tiktokQueries.map((query) => ({
              title: query,
              href: social.tiktok(query),
              meta: "TikTok",
            })),
            ...profile.instagramHashtags.map((tag) => ({
              title: `#${tag}`,
              href: social.instagramTag(tag),
              meta: "Instagram",
            })),
          ]}
        />
      </section>
    </div>
  )
}
