"use client"

import { Check, Plus } from "lucide-react"
import { motion } from "motion/react"
import { springs } from "@/lib/design/tokens"
import { followItem } from "@/lib/follows"
import { toggleSaved, useIsSaved } from "@/lib/saves"
import { cn } from "@/lib/utils"

interface FollowButtonProps {
  slug: string
  name: string
  tagline: string
  imageUrl: string | null
}

/**
 * Follow a niche. No accounts yet, so follows live in the same on-device
 * saves store as everything else (Phase 6 migrates them to your account).
 * Optimistic: the button flips instantly.
 */
export function FollowButton({ slug, name, tagline, imageUrl }: FollowButtonProps) {
  const item = followItem({ slug, name, tagline, imageUrl })
  const following = useIsSaved(item.id)
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      transition={springs.press}
      aria-pressed={following}
      onClick={() => toggleSaved(item)}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full px-6 text-callout font-semibold transition-colors",
        following
          ? "border border-white/40 bg-black/30 text-white backdrop-blur-md hover:bg-black/40"
          : "bg-white text-black hover:bg-white/90",
      )}
    >
      {following ? (
        <Check aria-hidden className="size-4" strokeWidth={2} />
      ) : (
        <Plus aria-hidden className="size-4" strokeWidth={2} />
      )}
      {following ? "Following" : "Follow"}
    </motion.button>
  )
}
