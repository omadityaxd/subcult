import { CircleUser, Compass, House, Sparkles, type LucideIcon } from "lucide-react"

export interface NavItem {
  href: "/" | "/explore" | "/vibe-check" | "/me"
  label: string
  icon: LucideIcon
  isActive: (pathname: string) => boolean
}

/** One nav definition shared by the mobile tab bar and the desktop sidebar. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "For you", icon: House, isActive: (p) => p === "/" },
  {
    href: "/explore",
    label: "Explore",
    icon: Compass,
    isActive: (p) => p.startsWith("/explore") || p.startsWith("/n/"),
  },
  {
    href: "/vibe-check",
    label: "Vibe check",
    icon: Sparkles,
    isActive: (p) => p.startsWith("/vibe-check"),
  },
  { href: "/me", label: "Me", icon: CircleUser, isActive: (p) => p.startsWith("/me") },
]

/** Buttons dispatch this to open the ⌘K palette from anywhere. */
export const OPEN_SEARCH_EVENT = "subcult:open-search"
