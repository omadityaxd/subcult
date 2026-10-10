"use client"

import { Bookmark } from "lucide-react"
import { motion } from "motion/react"
import { springs } from "@/lib/design/tokens"
import { type SavedItem, toggleSaved, useIsSaved } from "@/lib/saves"
import { cn } from "@/lib/utils"

interface SaveButtonProps {
  item: Omit<SavedItem, "savedAt">
  className?: string
  /** "overlay" sits on imagery (frosted chip); "plain" sits on surfaces. */
  tone?: "overlay" | "plain"
}

export function SaveButton({ item, className, tone = "plain" }: SaveButtonProps) {
  const saved = useIsSaved(item.id)
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.85 }}
      transition={springs.press}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save"}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        toggleSaved(item)
      }}
      className={cn(
        "grid size-9 place-items-center rounded-full",
        tone === "overlay"
          ? "bg-black/35 text-white backdrop-blur-md"
          : "text-foreground hover:bg-muted",
        className,
      )}
    >
      <Bookmark
        aria-hidden
        className="size-[18px]"
        strokeWidth={1.5}
        fill={saved ? "currentColor" : "none"}
      />
    </motion.button>
  )
}
