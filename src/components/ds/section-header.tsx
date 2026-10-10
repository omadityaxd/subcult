import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  title: ReactNode
  overline?: string
  action?: { label: string; href: string }
  className?: string
  /** Serif for editorial moments, sans for utility sections. */
  serif?: boolean
}

export function SectionHeader({ title, overline, action, className, serif }: SectionHeaderProps) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {overline ? (
          <p className="mb-1 text-overline font-medium text-muted-foreground uppercase">
            {overline}
          </p>
        ) : null}
        <h2
          className={cn(
            "truncate",
            serif ? "font-serif text-title-2 italic" : "text-title-3 font-semibold",
          )}
        >
          {title}
        </h2>
      </div>
      {action ? (
        <Link
          href={action.href}
          className="shrink-0 text-footnote font-medium text-muted-foreground hover:text-foreground"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}
