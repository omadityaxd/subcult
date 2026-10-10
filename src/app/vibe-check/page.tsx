import { X } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { EmptyState } from "@/components/shell/empty-state"
import { Screen } from "@/components/shell/screen"

export const metadata: Metadata = { title: "vibe check" }

/** Full-screen flow (no tab bar). The swipe deck lands in Phase 5. */
export default function VibeCheckPage() {
  return (
    <Screen withTabBar={false} className="flex flex-col">
      <header className="flex h-(--nav-bar-height) items-center justify-end px-4 pt-safe">
        <Link
          href="/"
          transitionTypes={["nav-back"]}
          aria-label="Close vibe check"
          className="grid size-9 place-items-center rounded-full bg-muted"
        >
          <X aria-hidden className="size-5" />
        </Link>
      </header>
      <div className="flex flex-1 items-center px-4">
        <EmptyState
          className="w-full"
          title="the vibe check is cooking"
          body="12 swipe cards, one brutally accurate niche mix. almost ready."
        />
      </div>
    </Screen>
  )
}
