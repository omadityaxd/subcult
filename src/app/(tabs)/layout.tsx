import { Suspense } from "react"
import { MiniPlayer } from "@/components/player/mini-player"
import { ReelsHost } from "@/components/video/reels-host"
import { CommandPaletteHost } from "@/components/shell/command-palette-host"
import { TasteTrackerForViewer } from "@/components/taste/taste-tracker-server"
import { TasteTracker } from "@/components/taste/taste-tracker"
import { WrappedTracker } from "@/components/wrapped/trackers"
import { PushPromptHost } from "@/components/alerts/push-prompt"
import { PwaShell } from "@/components/pwa/pwa-shell"
import { SignedOutRestoreGuard } from "@/components/me/sign-out-button"
import { env } from "@/lib/env"
import { Sidebar, SidebarView } from "@/components/shell/sidebar"
import { TabBar, TabBarView } from "@/components/shell/tab-bar"
import { NICHE_PRESETS } from "@/lib/niches/catalog"

/**
 * Real per-device layouts: bottom tab bar on phones, collapsible icon rail
 * on tablets and mid-width desktops, full sidebar from 1280px.
 */
export default function TabsLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh md:pl-(--rail-width) xl:pl-(--sidebar-width)">
      {/* Nav reads the URL; static fallbacks fill the prerendered shell. */}
      <Suspense fallback={<SidebarView pathname={null} />}>
        <Sidebar />
      </Suspense>
      {children}
      <Suspense fallback={<TabBarView pathname={null} />}>
        <TabBar />
      </Suspense>
      {/* Audio lives in a module singleton; this UI follows it across pages. */}
      <MiniPlayer />
      <ReelsHost />
      <WrappedTracker />
      {/* Guests learn on-device from the static shell; the session adds account sync. */}
      <Suspense fallback={<TasteTracker signedIn={false} />}>
        <TasteTrackerForViewer />
      </Suspense>
      <CommandPaletteHost presets={NICHE_PRESETS} />
      <PwaShell />
      <SignedOutRestoreGuard />
      {/* Reads the URL (it waits out onboarding), so it gets its own boundary. */}
      <Suspense fallback={null}>
        <PushPromptHost vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
      </Suspense>
    </div>
  )
}
