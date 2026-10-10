"use client"

import { Check, Hash, Image as ImageIcon, Music2 } from "lucide-react"
import { useState } from "react"
import { readableTextColor } from "@/lib/color"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { social } from "@/lib/links"
import { LinkCard, SectionHeading } from "../link-card"

type MoodboardProfile = Pick<
  NicheProfile,
  "palette" | "vibeWords" | "pinterestQueries" | "instagramHashtags" | "tiktokQueries"
>

const COPIED_RESET_MS = 1500

/** Palette swatches (tap to copy), vibe words, and big jumps into visual platforms. */
export function MoodboardSection({ profile }: { profile: MoodboardProfile }) {
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(hex: string) {
    try {
      await navigator.clipboard.writeText(hex)
      setCopied(hex)
      setTimeout(() => setCopied((current) => (current === hex ? null : current)), COPIED_RESET_MS)
    } catch {
      // Clipboard blocked (insecure context / permissions): the hex is still visible on the swatch.
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading>the palette</SectionHeading>
        <ul className="grid grid-cols-5 gap-2">
          {profile.palette.map((hex) => {
            const ink = readableTextColor(hex)
            return (
              <li key={hex}>
                <button
                  type="button"
                  onClick={() => copy(hex)}
                  aria-label={`Copy ${hex}`}
                  className="flex aspect-[1/2] w-full items-end justify-center rounded-2xl pb-3 text-[11px] font-semibold tracking-wide uppercase transition-transform active:scale-95"
                  style={{ backgroundColor: hex, color: ink }}
                >
                  {copied === hex ? <Check aria-hidden className="size-4" /> : hex.slice(1)}
                </button>
              </li>
            )
          })}
        </ul>
        <p aria-live="polite" className="mt-2 h-5 text-[13px] text-muted-foreground">
          {copied ? `copied ${copied}` : "tap a swatch to copy the hex"}
        </p>
      </section>

      <section aria-label="Vibe words">
        <p className="flex flex-wrap gap-x-3 gap-y-1 font-display text-[28px] leading-tight font-bold">
          {profile.vibeWords.map((word, index) => (
            <span key={word} className={index % 3 === 0 ? "text-niche" : undefined}>
              {word}
            </span>
          ))}
        </p>
      </section>

      <section>
        <SectionHeading>go deeper</SectionHeading>
        <div className="space-y-2">
          {profile.pinterestQueries.map((query) => (
            <LinkCard
              key={`pin-${query}`}
              href={social.pinterest(query)}
              title={query}
              subtitle="on pinterest"
              icon={<ImageIcon aria-hidden className="size-5" />}
            />
          ))}
          {profile.tiktokQueries.map((query) => (
            <LinkCard
              key={`tt-${query}`}
              href={social.tiktok(query)}
              title={query}
              subtitle="on tiktok"
              icon={<Music2 aria-hidden className="size-5" />}
            />
          ))}
        </div>
        <ul aria-label="Instagram hashtags" className="mt-4 flex flex-wrap gap-2">
          {profile.instagramHashtags.map((tag) => (
            <li key={tag}>
              <a
                href={social.instagramTag(tag)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-full bg-card px-3.5 py-2 text-[15px] font-medium transition-transform active:scale-95"
              >
                <Hash aria-hidden className="size-4 text-niche" />
                {tag}
                <span className="sr-only">on instagram (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
