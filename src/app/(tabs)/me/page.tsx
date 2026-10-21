import { ArrowRight } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { AccountSection } from "@/components/me/account-section"
import { Skeleton } from "@/components/ui/skeleton"
import { Cover } from "@/components/ds/cover"
import { SectionHeader } from "@/components/ds/section-header"
import { AutoplaySetting } from "@/components/me/autoplay-setting"
import { SpotifyConnectSetting } from "@/components/me/spotify-connect-setting"
import { env, features } from "@/lib/env"
import { FollowingRail } from "@/components/me/following-rail"
import { SavedGrid } from "@/components/me/saved-grid"
import { VibeResultCard } from "@/components/me/vibe-result-card"
import { TasteSection } from "@/components/me/taste-section"
import { IssueArchive } from "@/components/issue/issue-archive"
import { AlertSettings } from "@/components/alerts/alert-settings"
import { FriendsSection } from "@/components/social/friends-section"
import { WrappedCard } from "@/components/wrapped/wrapped-card"
import { NICHE_PRESETS } from "@/lib/niches/catalog"
import ARTISTS from "../../../../data/taxonomy/artists.json"
import { LargeTitle } from "@/components/shell/large-title"
import { Screen } from "@/components/shell/screen"
import { ThemeToggle } from "@/components/shell/theme-toggle"
import { AccountDataSection } from "@/components/me/account-data-section"
import { LegalLinks } from "@/components/shell/legal-links"

export const metadata: Metadata = { title: "Me" }

const CARD_PALETTE = ["#101014", "#24324a", "#5b7fa6", "#c9a27e", "#efe6da"]

export default function MePage() {
  const cardNiches = Object.fromEntries(
    NICHE_PRESETS.map((preset) => [preset.slug, { name: preset.name, palette: preset.palette }]),
  )
  const artistImages = Object.fromEntries(
    ARTISTS.flatMap((artist) => (artist.imageUrl ? [[artist.name, artist.imageUrl]] : [])),
  )
  return (
    <Screen>
      <LargeTitle overline="Your corner" title="Me" />
      <div className="container-page space-y-12">
        <Suspense fallback={<Skeleton className="h-16 w-full rounded-2xl" />}>
          <AccountSection />
        </Suspense>

        <VibeResultCard niches={cardNiches} fallback={<NicheCardTeaser />} />

        <WrappedCard niches={cardNiches} artistImages={artistImages} />

        <IssueArchive />

        <TasteSection />

        <FriendsSection />

        <AlertSettings vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />

        <FollowingRail />

        <section>
          <SectionHeader title="Saved" />
          <SavedGrid />
        </section>

        <section>
          <SectionHeader title="Settings" />
          <div className="space-y-3">
            <AutoplaySetting />
            {features.spotifyConnect && env.SPOTIFY_CLIENT_ID ? (
              <SpotifyConnectSetting clientId={env.SPOTIFY_CLIENT_ID} />
            ) : null}
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-card px-4 py-3 hairline-b">
              <span className="text-body">Appearance</span>
              <ThemeToggle />
            </div>
          </div>
        </section>

        <Suspense fallback={null}>
          <AccountDataSection />
        </Suspense>

        <LegalLinks />
      </div>
    </Screen>
  )
}

/** Placeholder for the shareable niche card (Phase 7); the vibe check fills it. */
function NicheCardTeaser() {
  return (
    <Link href="/vibe-check" transitionTypes={["nav-forward"]} className="group block">
      <Cover
        palette={CARD_PALETTE}
        seed="niche-card"
        className="relative flex aspect-[16/10] max-h-80 w-full flex-col justify-between rounded-3xl p-6 text-white md:aspect-[21/9] md:p-8"
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-3xl bg-gradient-to-b from-black/35 via-transparent to-black/45"
        />
        <span className="relative text-overline font-medium text-white/80 uppercase">
          Your niche card
        </span>
        <span className="relative">
          <span className="block font-serif text-title-1 text-balance italic">
            Not decoded yet.
          </span>
          <span className="mt-3 inline-flex items-center gap-1.5 text-callout font-medium text-white/85 transition-transform group-hover:translate-x-0.5">
            Take the vibe check to get yours
            <ArrowRight aria-hidden className="size-4" strokeWidth={1.75} />
          </span>
        </span>
      </Cover>
    </Link>
  )
}
