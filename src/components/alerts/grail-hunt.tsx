"use client"

import { BellPlus, Check } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { announceMeaningfulAction } from "@/lib/alerts/client"
import type { ApiResponse } from "@/lib/request"
import { track } from "@/lib/analytics"

/** The listing title's piece, minus brand and noise: "Rick Owens Geobasket Size 43 Black" → "geobasket". */
export function guessItem(title: string, brand: string): string {
  const drop = new Set([
    ...brand.toLowerCase().split(/\s+/),
    "size",
    "sz",
    "mens",
    "womens",
    "men's",
    "women's",
    "vintage",
    "rare",
    "authentic",
    "new",
    "nwt",
    "used",
  ])
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !drop.has(w) && !/^\d+$/.test(w) && !/^(ss|fw|aw)\d+$/.test(w))
    .slice(0, 2)
    .join(" ")
}

/**
 * "Alert me for similar under $X" on a listing: saves a grail hunt (brand +
 * item + max price + optional size) checked daily against new eBay listings.
 */
export function GrailHunt({
  brandSlug,
  brand,
  title,
  price,
}: {
  brandSlug: string
  brand: string
  title: string
  price: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [item, setItem] = useState(() => guessItem(title, brand))
  const [maxPrice, setMaxPrice] = useState(() => String(Math.max(10, Math.round(price))))
  const [size, setSize] = useState("")
  const [state, setState] = useState<"idle" | "saving" | "saved" | { error: string }>("idle")

  if (state === "saved") {
    return (
      <p className="mt-3 flex items-center justify-center gap-2 text-footnote font-semibold">
        <Check aria-hidden className="size-4" strokeWidth={2} /> Hunting {brand} {item} under $
        {maxPrice}
      </p>
    )
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border-strong text-callout font-semibold"
      >
        <BellPlus aria-hidden className="size-4" strokeWidth={1.75} />
        Alert me for similar under ${Math.round(price)}
      </button>
    )
  }

  const save = async () => {
    setState("saving")
    const response = await fetch("/api/grails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandSlug,
        item: item.trim(),
        maxPrice: Number(maxPrice),
        size: size.trim() || null,
      }),
    }).catch(() => null)
    if (response?.status === 401) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`)
      return
    }
    const body = response ? ((await response.json()) as ApiResponse<unknown>) : null
    if (!body?.success) {
      setState({ error: body && !body.success ? body.error : "Couldn't save. Try again." })
      return
    }
    setState("saved")
    track("grail_hunt_saved", { sized: size.trim().length > 0 })
    announceMeaningfulAction("grail")
  }

  const field =
    "h-11 w-full rounded-xl border border-border-strong bg-transparent px-3 text-callout"
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
      className="mt-3 space-y-2 rounded-2xl border border-border p-3"
    >
      <p className="text-footnote font-semibold">Hunt {brand}</p>
      <label className="block text-caption text-muted-foreground">
        Piece
        <input
          value={item}
          onChange={(e) => setItem(e.target.value)}
          required
          minLength={2}
          maxLength={60}
          className={field}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-caption text-muted-foreground">
          Max price ($)
          <input
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            required
            className={field}
          />
        </label>
        <label className="block text-caption text-muted-foreground">
          Size (optional)
          <input
            value={size}
            onChange={(e) => setSize(e.target.value)}
            maxLength={12}
            placeholder="M, 48, US 10"
            className={field}
          />
        </label>
      </div>
      {typeof state === "object" ? (
        <p className="text-footnote text-destructive">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={state === "saving" || item.trim().length < 2 || !maxPrice}
        className="h-11 w-full rounded-full bg-foreground text-callout font-semibold text-background disabled:opacity-50"
      >
        {state === "saving" ? "Saving…" : "Alert me"}
      </button>
      <p className="text-center text-caption text-muted-foreground">
        Checked daily against new eBay listings. Size must be in the listing title.
      </p>
    </form>
  )
}
