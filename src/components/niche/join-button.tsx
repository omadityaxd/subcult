"use client"

import { Plus } from "lucide-react"
import { type CSSProperties, useState } from "react"
import { ResponsiveSheet } from "@/components/ds/responsive-sheet"

interface JoinButtonProps {
  name: string
  themeStyle: CSSProperties
}

/** "add to my niches". Joining needs an account, so for now it opens the sign-in sheet. */
export function JoinButton({ name, themeStyle }: JoinButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-niche px-5 py-2.5 text-[15px] font-semibold text-niche-foreground shadow-lg transition-transform active:scale-95"
      >
        <Plus aria-hidden className="size-4" strokeWidth={2.6} />
        add to my niches
      </button>
      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title={`join ${name}`}
        description="sign in to save niches, keep your feed and get your own niche card."
        themeStyle={themeStyle}
      >
        <p className="rounded-2xl bg-card p-4 text-[15px] text-muted-foreground">
          one tap with google or a magic link. accounts are dropping very soon. until then, browse
          like nobody&apos;s watching 👀
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-4 w-full rounded-full bg-niche py-3 text-[17px] font-semibold text-niche-foreground active:scale-[0.98]"
        >
          ok, bet
        </button>
      </ResponsiveSheet>
    </>
  )
}
