"use client"

import { motion, type HTMLMotionProps } from "motion/react"
import { PRESS_SCALE, springs } from "@/lib/motion"
import { cn } from "@/lib/utils"

interface PressableProps extends HTMLMotionProps<"div"> {
  scale?: number
}

/** Springy press-scale wrapper for anything tappable (cards, chips, tiles). */
export function Pressable({ scale = PRESS_SCALE, className, ...props }: PressableProps) {
  return (
    <motion.div
      whileTap={{ scale }}
      transition={springs.press}
      className={cn("select-none", className)}
      {...props}
    />
  )
}
