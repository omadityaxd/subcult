"use client"

import { TriangleAlert } from "lucide-react"
import { useEffect } from "react"
import Link from "next/link"
import { EmptyState } from "@/components/shell/empty-state"
import { Screen } from "@/components/shell/screen"
import { reportError } from "@/lib/analytics"

/** A page that failed to render: said plainly, with a retry and a way home. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportError(error, error.digest ? { digest: error.digest } : undefined)
  }, [error])
  return (
    <Screen withTabBar={false} className="flex items-center justify-center px-4">
      <EmptyState
        icon={TriangleAlert}
        title="That one broke on our side"
        body="It's been reported. Try again, or head back to today's issue."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="h-11 rounded-full bg-foreground px-5 text-callout font-semibold text-background"
            >
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex h-11 items-center rounded-full border border-border-strong px-5 text-callout font-semibold"
            >
              Today&apos;s issue
            </Link>
          </div>
        }
      />
    </Screen>
  )
}
