"use client"

import { ArrowUpRight } from "lucide-react"
import { MediaImage } from "@/components/ds/media-image"
import { ResponsiveSheet } from "@/components/ds/responsive-sheet"
import { SaveButton } from "@/components/ds/save-button"
import { social } from "@/lib/links"
import { similarPins } from "@/lib/moodboard/board"
import { PIN_SOURCE_LABEL, type Pin } from "@/lib/moodboard/types"

/** Unsplash asks apps to ping download_location when a photo is "used" (saved here). */
function trackUnsplashUse(pin: Pin) {
  if (!pin.downloadLocation) return
  void fetch("/api/moodboard/unsplash-use", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ downloadLocation: pin.downloadLocation }),
  }).catch(() => undefined)
}

/** Tap-to-expand pin: bigger image, credit, save, more like this. Pinterest is a small search link. */
export function PinSheet({
  pin,
  pins,
  pinterestQuery,
  onOpen,
  onClose,
}: {
  pin: Pin
  pins: readonly Pin[]
  pinterestQuery: string | null
  onOpen: (pin: Pin) => void
  onClose: () => void
}) {
  const similar = similarPins(pins, pin, 6)
  return (
    <ResponsiveSheet
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={pin.title ?? PIN_SOURCE_LABEL[pin.source]}
    >
      <div
        className="relative w-full overflow-hidden rounded-2xl bg-muted"
        style={{
          aspectRatio: pin.width && pin.height ? `${pin.width} / ${pin.height}` : "4 / 5",
          maxHeight: "60dvh",
        }}
      >
        <MediaImage
          src={pin.largeUrl}
          alt={pin.title ?? ""}
          sizes="(max-width: 768px) 100vw, 560px"
          className="object-contain"
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        {pin.color ? (
          <span
            aria-label={`Dominant color ${pin.color}`}
            className="size-6 shrink-0 rounded-full border border-border"
            style={{ backgroundColor: pin.color }}
          />
        ) : null}
        <div className="min-w-0 flex-1 text-footnote text-muted-foreground">
          {pin.credit ? (
            <a
              href={pin.credit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {pin.credit.label}
            </a>
          ) : (
            PIN_SOURCE_LABEL[pin.source]
          )}
        </div>
        <span onClickCapture={() => trackUnsplashUse(pin)}>
          <SaveButton
            item={{
              id: `pin:${pin.id}`,
              title: pin.title ?? PIN_SOURCE_LABEL[pin.source],
              url: pin.pageUrl,
              imageUrl: pin.imageUrl,
              source: "subcult",
              subtitle: pin.credit?.label ?? null,
            }}
            className="size-10 bg-muted"
          />
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
        <a
          href={pin.pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 hover:text-foreground"
        >
          View on {PIN_SOURCE_LABEL[pin.source].replace(/ (photo|art|still)$/i, "")}
          <ArrowUpRight aria-hidden className="size-3" strokeWidth={1.75} />
        </a>
        {pinterestQuery ? (
          <a
            href={social.pinterest(pinterestQuery)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 hover:text-foreground"
          >
            Search Pinterest
            <ArrowUpRight aria-hidden className="size-3" strokeWidth={1.75} />
          </a>
        ) : null}
      </div>

      {similar.length > 0 ? (
        <>
          <p className="mt-6 mb-2 text-overline font-medium text-muted-foreground uppercase">
            More like this
          </p>
          <ul className="grid grid-cols-3 gap-2">
            {similar.map((other) => (
              <li key={other.id}>
                <button
                  type="button"
                  onClick={() => onOpen(other)}
                  aria-label={other.title ?? "Open pin"}
                  className="relative block aspect-square w-full overflow-hidden rounded-xl bg-muted active:scale-[0.98]"
                >
                  <MediaImage src={other.imageUrl} alt="" sizes="120px" />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </ResponsiveSheet>
  )
}
