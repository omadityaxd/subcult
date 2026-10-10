"use client"

import type { CSSProperties, ReactNode } from "react"
import { Drawer } from "vaul"

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  /** Sheets portal to <body>; pass the niche theme so they keep its colors. */
  themeStyle?: CSSProperties
}

/** iOS-style bottom sheet (vaul): drag to dismiss, sized to the app column. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  themeStyle,
}: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <Drawer.Content
          data-niche={themeStyle ? "" : undefined}
          style={themeStyle}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full max-w-(--column-width) flex-col rounded-t-[28px] bg-elevated outline-none"
        >
          <Drawer.Handle className="mt-2.5 mb-1 bg-foreground/20" />
          <div className="overflow-y-auto px-5 pt-3 pb-safe">
            <Drawer.Title className="font-display text-[22px] leading-tight font-semibold">
              {title}
            </Drawer.Title>
            <Drawer.Description
              className={description ? "mt-1 text-[15px] text-muted-foreground" : "sr-only"}
            >
              {description ?? title}
            </Drawer.Description>
            <div className="mt-4 pb-6">{children}</div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
