import { WifiOff } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { EmptyState } from "@/components/shell/empty-state"
import { Screen } from "@/components/shell/screen"

export const metadata: Metadata = { title: "No connection", robots: { index: false } }

/** What the service worker shows when a page can't load without a connection. */
export default function OfflinePage() {
  return (
    <Screen withTabBar={false} className="flex items-center justify-center px-4">
      <EmptyState
        icon={WifiOff}
        title="No connection"
        body="Today's issue is saved on this device once you've opened it. The rest comes back with your signal."
        action={
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-full bg-foreground px-5 text-callout font-semibold text-background"
          >
            Open today&apos;s issue
          </Link>
        }
      />
    </Screen>
  )
}
