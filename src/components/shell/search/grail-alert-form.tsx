"use client"

import { Bell } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import type { ApiResponse } from "@/lib/request"
import { maybeSignedIn } from "@/lib/supabase/session-hint"

/**
 * "Alert me" from search: hunt a piece from this brand under a price.
 * Hunts match titles word for word, so it asks which piece.
 */
export function GrailAlertForm({
  brand,
  onDone,
}: {
  brand: { slug: string; name: string }
  onDone: () => void
}) {
  const [item, setItem] = useState("")
  const [maxPrice, setMaxPrice] = useState("500")
  const [state, setState] = useState<"idle" | "saving" | "saved" | string>("idle")

  if (!maybeSignedIn()) {
    return (
      <p className="px-4 py-3 text-footnote text-muted-foreground">
        <Link href="/login?next=/me" className="font-semibold text-foreground underline">
          Sign in
        </Link>{" "}
        to get an alert when {brand.name} pieces are listed.
      </p>
    )
  }
  if (state === "saved") {
    return (
      <p role="status" className="px-4 py-3 text-footnote">
        Hunting {brand.name} {item} under ${maxPrice}. You&apos;ll get an alert when one is listed.
      </p>
    )
  }
  return (
    <form
      className="flex flex-wrap items-end gap-2 px-4 py-3"
      onSubmit={async (event) => {
        event.preventDefault()
        setState("saving")
        const response = await fetch("/api/grails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandSlug: brand.slug,
            item: item.trim(),
            maxPrice: Number(maxPrice),
            size: null,
          }),
        }).catch(() => null)
        const body = response ? ((await response.json()) as ApiResponse<unknown>) : null
        if (body?.success) {
          setState("saved")
          setTimeout(onDone, 1600)
        } else setState(body && !body.success ? body.error : "Couldn't save that. Try again.")
      }}
    >
      <label className="min-w-0 flex-1">
        <span className="text-caption text-muted-foreground">Which {brand.name} piece?</span>
        <input
          required
          minLength={2}
          maxLength={60}
          value={item}
          onChange={(event) => setItem(event.target.value)}
          placeholder="e.g. geobasket"
          className="mt-1 h-10 w-full rounded-lg border border-border-strong bg-transparent px-3 text-callout outline-none focus:border-foreground"
        />
      </label>
      <label className="w-24">
        <span className="text-caption text-muted-foreground">Max $</span>
        <input
          required
          type="number"
          min={10}
          max={50000}
          value={maxPrice}
          onChange={(event) => setMaxPrice(event.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-border-strong bg-transparent px-3 text-callout tabular-nums outline-none focus:border-foreground"
        />
      </label>
      <button
        type="submit"
        disabled={state === "saving"}
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-4 text-footnote font-semibold text-background disabled:opacity-60"
      >
        <Bell aria-hidden className="size-4" strokeWidth={1.75} />
        Alert me
      </button>
      {state !== "idle" && state !== "saving" ? (
        <p role="alert" className="basis-full text-caption text-muted-foreground">
          {state}
        </p>
      ) : null}
    </form>
  )
}
