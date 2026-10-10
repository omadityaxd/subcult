import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  emoji: string
  title: string
  body?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ emoji, title, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-3xl bg-card px-6 py-10 text-center",
        className,
      )}
    >
      <span aria-hidden className="text-5xl">
        {emoji}
      </span>
      <p className="font-display mt-4 text-xl font-semibold">{title}</p>
      {body ? <p className="mt-1.5 max-w-xs text-[15px] text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
