import { Suspense } from "react"
import { TabBar, TabBarView } from "@/components/shell/tab-bar"

export default function TabsLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {children}
      {/* The active tab depends on the URL; the static bar fills the prerendered shell. */}
      <Suspense fallback={<TabBarView pathname={null} />}>
        <TabBar />
      </Suspense>
    </>
  )
}
