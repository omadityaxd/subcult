import Link from "next/link"
import { EmptyState } from "@/components/shell/empty-state"
import { Screen } from "@/components/shell/screen"

export default function NotFound() {
  return (
    <Screen withTabBar={false} className="flex items-center px-4">
      <EmptyState
        className="w-full"
        emoji="🫠"
        title="this page is not giving"
        body="either it never existed or it was too niche even for us."
        action={
          <Link
            href="/"
            className="rounded-full bg-accent px-5 py-2.5 text-[15px] font-semibold text-accent-foreground"
          >
            take me home
          </Link>
        }
      />
    </Screen>
  )
}
