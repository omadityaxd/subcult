import { TabBar } from "@/components/shell/tab-bar"

export default function TabsLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {children}
      <TabBar />
    </>
  )
}
