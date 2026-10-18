"use client"

import { Share } from "lucide-react"
import { useState } from "react"
import { Cover } from "@/components/ds/cover"
import { MediaImage } from "@/components/ds/media-image"
import type { IssueCover as IssueCoverData } from "@/lib/today/edition"
import { formatIssueNo } from "@/lib/today/issues"

const FALLBACK_PALETTE = ["#0b0a10", "#1d1b2a", "#4b4470", "#c9b8ff", "#f5f2ff"]

/**
 * The issue's cover: a full-bleed image of the day (a fit, a grail, or the
 * lead story) with an oversized serif headline and the three cover lines.
 * With no image, the reader's top niche's palette makes the cover.
 */
export function IssueCover({
  cover,
  issueNo,
  dateLabel,
}: {
  cover: IssueCoverData
  issueNo: number
  dateLabel: string
}) {
  const image = cover.item?.imageUrl ?? null
  const body = (
    <div className="relative flex h-full flex-col justify-between p-5 text-white md:p-10">
      <div className="flex items-start justify-between gap-3">
        <span className="font-serif text-[34px] leading-none italic md:text-[52px]">subcult</span>
        <span className="text-right text-caption font-semibold tracking-[0.2em] text-white/80 uppercase">
          No. {formatIssueNo(issueNo)}
          <br />
          <span className="font-normal tracking-normal normal-case">{dateLabel}</span>
        </span>
      </div>
      <div>
        <h2
          data-testid="issue-headline"
          className="max-w-3xl font-serif text-[44px] leading-[0.95] text-balance italic md:text-[84px]"
        >
          {cover.headline}
        </h2>
        {cover.lines.length > 0 ? (
          <ul className="mt-5 max-w-xl space-y-1.5 text-callout font-medium text-white/90">
            {cover.lines.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden className="text-white/60">
                  —
                </span>
                <span className="line-clamp-2">{line}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
  return (
    <figure
      data-kind="cover"
      className="relative -mx-(--gutter) aspect-[4/5] overflow-hidden md:mx-0 md:aspect-[16/9] md:rounded-3xl"
    >
      {image ? (
        <>
          <MediaImage src={image} alt="" sizes="(max-width: 768px) 100vw, 1100px" priority />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/75"
          />
          <div className="absolute inset-0">{body}</div>
        </>
      ) : (
        <Cover
          palette={cover.palette ?? FALLBACK_PALETTE}
          seed={`issue-${issueNo}`}
          className="absolute inset-0"
        >
          {body}
        </Cover>
      )}
    </figure>
  )
}

/** Shares the cover as a 1080×1920 image with the reader's handle on the masthead. */
export function ShareCoverButton({
  cover,
  issueNo,
  day,
}: {
  cover: IssueCoverData
  issueNo: number
  day: string
}) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        const params = new URLSearchParams({
          no: String(issueNo),
          day,
          headline: cover.headline,
          lines: cover.lines.join("\n"),
        })
        if (cover.item?.imageUrl) params.set("img", cover.item.imageUrl)
        if (cover.palette) params.set("palette", cover.palette.join(","))
        try {
          const response = await fetch(`/issue/card?${params}`)
          if (!response.ok) throw new Error(String(response.status))
          const file = new File([await response.blob()], `subcult-issue-${issueNo}.png`, {
            type: "image/png",
          })
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file] }).catch(() => undefined)
          } else {
            const url = URL.createObjectURL(file)
            const a = document.createElement("a")
            a.href = url
            a.download = file.name
            a.click()
            URL.revokeObjectURL(url)
          }
        } catch {
          // Leave the button as-is; the cover is still on screen.
        } finally {
          setBusy(false)
        }
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-strong px-3.5 text-footnote font-semibold disabled:opacity-50"
    >
      <Share aria-hidden className="size-3.5" strokeWidth={2} />
      {busy ? "Making…" : "Share cover"}
    </button>
  )
}
