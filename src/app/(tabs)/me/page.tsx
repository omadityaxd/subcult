import type { Metadata } from "next"
import { EmptyState } from "@/components/shell/empty-state"
import { LargeTitle } from "@/components/shell/large-title"
import { Screen } from "@/components/shell/screen"
import { ThemeToggle } from "@/components/shell/theme-toggle"

export const metadata: Metadata = { title: "me" }

export default function MePage() {
  return (
    <Screen>
      <LargeTitle title="me" />
      <div className="space-y-8 px-4">
        <EmptyState
          title="browsing as a guest"
          body="signing in (soon) lets you save stuff, join niches and get your own niche card."
        />

        <section aria-labelledby="settings-heading">
          <h2
            id="settings-heading"
            className="mb-2 px-4 text-[13px] tracking-wide text-muted-foreground uppercase"
          >
            settings
          </h2>
          <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3">
            <span className="text-[17px]">appearance</span>
            <ThemeToggle />
          </div>
        </section>
      </div>
    </Screen>
  )
}
