import { Suspense } from "react"
import { MiniPlayer } from "@/components/player/mini-player"
import { ReelsHost } from "@/components/video/reels-viewer"
import { CommandPalette } from "@/components/shell/command-palette"
import { WrappedTracker } from "@/components/wrapped/trackers"
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
      <CommandPalette presets={NICHE_PRESETS} />
    </div>
  )
}
