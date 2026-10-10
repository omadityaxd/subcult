import type { CSSProperties } from "react"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { JoinButton } from "./join-button"

interface NicheHeroProps {
  profile: NicheProfile
  themeStyle: CSSProperties
  /** Lifecycle label, e.g. "🔥 new" for fresh trends. */
  badge?: string | null
}

/**
 * Full-bleed palette gradient that slides under the transparent nav bar.
 * Text sits on a scrim that fades into the page background, so it keeps
 * contrast whatever the palette is.
 */
export function NicheHero({ profile, themeStyle, badge }: NicheHeroProps) {
  return (
    <section className="relative -mt-[calc(var(--nav-bar-height)+env(safe-area-inset-top))] overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ backgroundImage: "var(--niche-gradient)" }}
      />
      <div
        aria-hidden
        className="absolute -top-24 left-1/2 size-96 -translate-x-1/2 rounded-full blur-3xl"
        style={{ backgroundColor: "var(--niche-glow)" }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/55 to-background"
      />

      <div className="relative px-5 pt-[calc(var(--nav-bar-height)+env(safe-area-inset-top)+3.5rem)] pb-6">
        <span aria-hidden className="block text-[64px] leading-none drop-shadow-lg">
          {profile.emoji}
        </span>
        {badge ? (
          <span className="mt-4 inline-block rounded-full bg-background/80 px-3 py-1 text-[13px] font-semibold">
            {badge}
          </span>
        ) : null}
        <h1 className="mt-5 font-display text-[42px] leading-[0.95] font-extrabold tracking-tight">
          {profile.name}
        </h1>
        <p className="mt-3 text-[17px] leading-snug text-foreground/85">{profile.tagline}</p>

        <div className="mt-6 flex items-center justify-between gap-4">
          <JoinButton name={profile.name} themeStyle={themeStyle} />
          <ul aria-label="Palette" className="flex -space-x-1.5">
            {profile.palette.map((color) => (
              <li
                key={color}
                className="size-6 rounded-full ring-2 ring-background"
                style={{ backgroundColor: color }}
              >
                <span className="sr-only">{color}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
