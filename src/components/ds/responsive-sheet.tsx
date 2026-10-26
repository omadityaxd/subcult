"use client"

import { useOverlay } from "@/lib/ui/overlays"
import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import type { CSSProperties, ReactNode } from "react"
import { Drawer } from "vaul"
import { useMediaQuery } from "@/lib/design/use-media-query"

interface ResponsiveSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  /** Overlays portal to <body>; pass the niche theme so they keep its accent. */
  themeStyle?: CSSProperties
}

/** Bottom sheet on phones (drag to dismiss), centered modal on tablet and desktop. */
export function ResponsiveSheet(props: ResponsiveSheetProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  // The mini-player hides while a sheet is up, so it never covers the sheet's buttons.
  useOverlay(props.open, () => props.onOpenChange(false))
  return isDesktop ? <Modal {...props} /> : <BottomSheet {...props} />
}

function Heading({ title, description }: { title: string; description?: string }) {
  return (
    <>
      <p className="font-serif text-title-2 italic">{title}</p>
      {description ? (
        <p className="mt-1.5 text-callout text-muted-foreground">{description}</p>
      ) : null}
    </>
  )
}

function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  themeStyle,
}: ResponsiveSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-(--z-sheet) bg-black/60" />
        <Drawer.Content
          data-niche={themeStyle ? "" : undefined}
          style={themeStyle}
          className="fixed inset-x-0 bottom-0 z-(--z-sheet) flex max-h-[88dvh] flex-col rounded-t-3xl bg-elevated outline-none"
        >
          <Drawer.Handle className="mt-2.5 mb-1 bg-foreground/20" />
          <div className="overflow-y-auto px-5 pt-3 pb-safe">
            <Drawer.Title asChild>
              <div>
                <Heading title={title} description={description} />
              </div>
            </Drawer.Title>
            <Drawer.Description className="sr-only">{description ?? title}</Drawer.Description>
            <div className="mt-5 pb-6">{children}</div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  themeStyle,
}: ResponsiveSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-(--z-sheet) bg-black/60 backdrop-blur-sm transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          data-niche={themeStyle ? "" : undefined}
          style={themeStyle}
          className="fixed top-1/2 left-1/2 z-(--z-sheet) max-h-[80dvh] w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-elevated p-6 shadow-pop transition-[opacity,scale] duration-200 outline-none data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
        >
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title render={<div />}>
              <Heading title={title} description={description} />
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-muted hover:bg-border-strong"
            >
              <X aria-hidden className="size-4" strokeWidth={1.5} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{description ?? title}</Dialog.Description>
          <div className="mt-5">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
