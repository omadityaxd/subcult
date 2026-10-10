import { Compass } from "lucide-react"
import { ButtonLink } from "@/components/ds/button"
import { EmptyState } from "@/components/shell/empty-state"
import { Screen } from "@/components/shell/screen"

export default function NotFound() {
  return (
    <Screen withTabBar={false} className="flex items-center justify-center px-4">
      <EmptyState
        icon={Compass}
        title="This page isn't giving"
        body="Either it never existed, or it was too niche even for us."
        action={<ButtonLink href="/">Take me home</ButtonLink>}
      />
    </Screen>
  )
}
