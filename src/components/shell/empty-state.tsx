import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  body?: string
  action?: ReactNode
  className?: string
}

/** Calm, editorial empty/error state: thin icon, serif title, one line of copy. */
export function EmptyState({ icon: Icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-16 text-center", className)}>
      {Icon ? (
        <span className="mb-5 grid size-14 place-items-center rounded-full border border-border-strong text-muted-foreground">
          <Icon aria-hidden className="size-6" strokeWidth={1.5} />
        </span>
      ) : null}
      <p className="max-w-sm font-serif text-title-2 text-balance italic">{title}</p>
      {body ? (
        <p className="mt-2 max-w-sm text-callout text-balance text-muted-foreground">{body}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
