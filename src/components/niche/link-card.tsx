import { ArrowUpRight } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface LinkCardProps {
  href: string
  title: string
  subtitle?: string
  icon?: ReactNode
  className?: string
}

/** Outbound link row: everything in subcult links out to where the content lives. */
export function LinkCard({ href, title, subtitle, icon, className }: LinkCardProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-3 rounded-2xl bg-card p-4 transition-transform duration-150 active:scale-[0.98]",
        className,
      )}
    >
      {icon ? (
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-niche/15 text-niche">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
      <ArrowUpRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-[20px] font-semibold tracking-tight">{children}</h2>
}
