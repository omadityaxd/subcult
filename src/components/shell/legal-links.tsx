import Link from "next/link"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/content-policy", label: "Content policy" },
] as const

/** The small print, linked wherever someone might look for it (Me, sidebar, sign-in, about). */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav
      aria-label="About and legal"
      className={cn("text-caption text-muted-foreground", className)}
    >
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
