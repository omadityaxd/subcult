import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"
import { NotificationCenter } from "@/components/alerts/notification-center"
import { LargeTitle } from "@/components/shell/large-title"
import { Screen } from "@/components/shell/screen"
import { Skeleton } from "@/components/ui/skeleton"
import { authEnabled, getViewer } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Notifications", robots: { index: false } }

export default function NotificationsPage() {
  return (
    <Screen>
      <LargeTitle overline="Drops, grails, your scenes" title="Notifications" />
      <div className="container-page max-w-2xl pb-16">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
          <Center />
        </Suspense>
      </div>
    </Screen>
  )
}

async function Center() {
  await connection()
  const viewer = authEnabled ? await getViewer() : null
  return <NotificationCenter signedIn={viewer !== null} />
}
