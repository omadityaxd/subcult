import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "admin",
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-dvh px-4 pt-safe pb-safe">
      <header className="flex h-(--nav-bar-height) items-center justify-between">
        <Link href="/" className="font-display text-[17px] font-bold">
          subcult <span className="text-muted-foreground">admin</span>
        </Link>
        <nav className="flex gap-4 text-[15px] text-muted-foreground">
          <Link href="/admin/usage" className="hover:text-foreground">
            usage
          </Link>
        </nav>
      </header>
      <main className="pb-10">{children}</main>
    </div>
  )
}
