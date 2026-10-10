"use client"

import { useState } from "react"
import { Button } from "@/components/ds/button"
import { DoubleTapSave } from "@/components/ds/double-tap-save"
import { ResponsiveSheet } from "@/components/ds/responsive-sheet"
import { SaveButton } from "@/components/ds/save-button"
import { Cover } from "@/components/ds/cover"

const demoItem = {
  id: "design:demo:1",
  title: "Double-tap me",
  url: "/design",
  imageUrl: null,
  source: "design",
  subtitle: null,
}

export function SheetDemo() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open sheet
      </Button>
      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title="where to cop"
        description="Bottom sheet on phones, centered modal from 768px."
      >
        <Button className="w-full" onClick={() => setOpen(false)}>
          Done
        </Button>
      </ResponsiveSheet>
    </>
  )
}

export function SaveDemo({ palette }: { palette: readonly string[] }) {
  return (
    <DoubleTapSave item={demoItem} className="w-56">
      <Cover palette={palette} seed="double-tap" className="relative aspect-square rounded-2xl">
        <SaveButton item={demoItem} tone="overlay" className="absolute top-3 right-3" />
        <p className="absolute bottom-3 left-4 font-serif text-title-3 text-white italic">
          double-tap to save
        </p>
      </Cover>
    </DoubleTapSave>
  )
}
