"use client"

import { Check, Copy, ShoppingBag, X } from "lucide-react"
import { useMemo, useState } from "react"
import { MediaImage } from "@/components/ds/media-image"
import { readableTextColor } from "@/lib/color"
import { pinsNearColor } from "@/lib/moodboard/board"
import type { Pin } from "@/lib/moodboard/types"
import { requestTab, setSwatch, useNicheUi } from "@/lib/niches/niche-ui-store"
import { cn } from "@/lib/utils"
import { PinSheet } from "./pin-sheet"

const COPIED_RESET_MS = 1500

/**
 * The niche's visual board. The palette is a control: picking a swatch
 * re-tints the page, filters the board (and the shop) to pins whose dominant
 * color is near it, and offers "shop this color" / "copy hex".
 */
export function MoodboardBoard({
  slug,
  palette,
  vibeWords,
  pins,
  pinterestQueries,
}: {
  slug: string
  palette: readonly string[]
  vibeWords: readonly string[]
  pins: readonly Pin[]
  pinterestQueries: readonly string[]
}) {
  const ui = useNicheUi()
  const swatch = ui.slug === slug ? ui.swatch : null
  const [open, setOpen] = useState<Pin | null>(null)
  const shown = useMemo(() => (swatch ? pinsNearColor(pins, swatch) : pins), [pins, swatch])

  return (
    <div className="space-y-8">
      <PalettePicker palette={palette} swatch={swatch} />

      <p className="font-serif text-title-2 leading-tight text-balance italic">
        {vibeWords.map((word, index) => (
          <span key={word}>
            <span className={index % 3 === 0 ? "text-niche" : undefined}>{word}</span>
            {index < vibeWords.length - 1 ? <span className="text-subtle"> · </span> : null}
          </span>
        ))}
      </p>

      {shown.length > 0 ? (
        <ul className="columns-2 gap-3 sm:columns-3 xl:columns-4" aria-label="Moodboard">
          {shown.map((pin) => (
            <li key={pin.id} className="mb-3 break-inside-avoid">
              <button
                type="button"
                onClick={() => setOpen(pin)}
                aria-label={pin.title ?? "Open pin"}
                className="group relative block w-full overflow-hidden rounded-xl bg-muted transition-transform active:scale-[0.98]"
                style={{
                  aspectRatio: pin.width && pin.height ? `${pin.width} / ${pin.height}` : "4 / 5",
                  backgroundColor: pin.color ?? undefined,
                }}
              >
                <MediaImage src={pin.imageUrl} alt="" sizes="(max-width: 640px) 50vw, 25vw" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-border-strong p-8 text-center">
          <p className="text-callout text-muted-foreground">
            {swatch ? "Nothing on the board in that color yet." : "The board is still loading up."}
          </p>
          {swatch ? (
            <button
              type="button"
              onClick={() => setSwatch(null)}
              className="mt-3 h-9 rounded-full border border-border-strong px-4 text-footnote font-medium hover:bg-muted"
            >
              Show everything
            </button>
          ) : null}
        </div>
      )}

      {open ? (
        <PinSheet
          key={open.id}
          pin={open}
          pins={pins}
          pinterestQuery={pinterestQueries[0] ?? null}
          onOpen={setOpen}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  )
}

function PalettePicker({ palette, swatch }: { palette: readonly string[]; swatch: string | null }) {
  const [copied, setCopied] = useState(false)

  async function copy(hex: string) {
    try {
      await navigator.clipboard.writeText(hex)
      setCopied(true)
      setTimeout(() => setCopied(false), COPIED_RESET_MS)
    } catch {
      // Clipboard blocked: the hex is printed right there.
    }
  }

  return (
    <section aria-label="Palette">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-overline font-medium text-muted-foreground uppercase">
          {swatch ? "Filtering by color" : "Tap a color"}
        </p>
        {swatch ? (
          <button
            type="button"
            onClick={() => setSwatch(null)}
            className="inline-flex items-center gap-1 text-footnote font-medium text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden className="size-3.5" strokeWidth={2} />
            Clear
          </button>
        ) : null}
      </div>
      <ul className="flex h-20 overflow-hidden rounded-2xl md:h-24">
        {palette.map((hex) => {
          const selected = hex === swatch
          return (
            <li
              key={hex}
              className={cn(
                "transition-[flex-grow] duration-300 ease-out",
                selected ? "flex-[2.2]" : "flex-1 hover:flex-[1.4]",
              )}
            >
              <button
                type="button"
                onClick={() => setSwatch(selected ? null : hex)}
                aria-pressed={selected}
                aria-label={`${selected ? "Stop filtering by" : "Filter by"} ${hex}`}
                className="flex h-full w-full items-end p-2.5 text-caption font-medium uppercase"
                style={{ backgroundColor: hex, color: readableTextColor(hex) }}
              >
                {selected ? (
                  <Check aria-hidden className="size-4" strokeWidth={2.25} />
                ) : (
                  <span className="opacity-70">{hex.slice(1)}</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {swatch ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => requestTab("archive")}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-strong px-3.5 text-footnote font-medium hover:bg-muted"
          >
            <ShoppingBag aria-hidden className="size-3.5" strokeWidth={1.75} />
            Shop this color
          </button>
          <button
            type="button"
            onClick={() => copy(swatch)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-strong px-3.5 text-footnote font-medium hover:bg-muted"
          >
            {copied ? (
              <Check aria-hidden className="size-3.5" strokeWidth={2} />
            ) : (
              <Copy aria-hidden className="size-3.5" strokeWidth={1.75} />
            )}
            {copied ? "Copied" : `Copy ${swatch}`}
          </button>
        </div>
      ) : null}
    </section>
  )
}
