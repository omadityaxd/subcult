"use client"

import { Plus } from "lucide-react"
import { type CSSProperties, useState } from "react"
import { Button } from "@/components/ds/button"
import { ResponsiveSheet } from "@/components/ds/responsive-sheet"

interface JoinButtonProps {
  name: string
  themeStyle: CSSProperties
}

/** "Join" needs an account, so for now it opens the sign-in sheet (accounts land in Phase 6). */
export function JoinButton({ name, themeStyle }: JoinButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-callout font-semibold text-black transition-transform hover:bg-white/90 active:scale-[0.97]"
      >
        <Plus aria-hidden className="size-4" strokeWidth={2} />
        Join
      </button>
      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title={`Join ${name}`}
        description="Sign in to keep your niches, your saves and your niche card on every device."
        themeStyle={themeStyle}
      >
        <p className="text-callout text-muted-foreground">
          One tap with Google or a magic link. Accounts are landing very soon. Until then, browse
          like nobody&apos;s watching.
        </p>
        <Button className="mt-6 w-full" size="lg" onClick={() => setOpen(false)}>
          Got it
        </Button>
      </ResponsiveSheet>
    </>
  )
}
