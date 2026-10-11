"use client"

import { ArrowRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { Cover } from "@/components/ds/cover"
import type { FeedItem } from "@/lib/feed/types"
import { BrandSheet } from "@/components/brand/brand-sheet"
import { ArtistSheet } from "../artists-row"

/** Our own cards in the feed: artists (in-app sheet), niches and quick actions. */
export function SubcultCard({ item }: { item: FeedItem }) {
  if (item.type === "artist") return <ArtistCard item={item} />
  if (item.type === "prompt") return <PromptCard item={item} />
  if (item.type === "brand") return <BrandCard item={item} />
  return <NicheTile item={item} />
}

function ArtistCard({ item }: { item: FeedItem }) {
  const [open, setOpen] = useState(false)
  const slug = typeof item.meta.artistSlug === "string" ? item.meta.artistSlug : null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-4 rounded-2xl border border-border p-4 text-left transition-colors hover:bg-muted"
      >
        <span className="relative size-16 shrink-0 overflow-hidden rounded-full bg-muted">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt=""
              fill
              sizes="64px"
              unoptimized
              className="object-cover"
            />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-overline font-medium text-muted-foreground uppercase">
            Artist
          </span>
          <span className="block truncate font-serif text-title-3 italic">{item.title}</span>
          <span className="block text-footnote text-muted-foreground">
            Top tracks, niches, more
          </span>
        </span>
        <ArrowRight
          aria-hidden
          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          strokeWidth={1.75}
        />
      </button>
      {open && slug ? (
        <ArtistSheet
          artist={{ slug, name: item.title, imageUrl: item.imageUrl }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

/** A brand, set in type (never its logo): tap for the brand sheet. */
function BrandCard({ item }: { item: FeedItem }) {
  const [open, setOpen] = useState(false)
  const slug = typeof item.meta.brandSlug === "string" ? item.meta.brandSlug : null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group block w-full rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:bg-muted active:scale-[0.99]"
      >
        <span className="block text-overline font-medium text-muted-foreground uppercase">
          Brand
        </span>
        <span className="mt-2 block font-serif text-title-1 leading-none italic">{item.title}</span>
        {item.subtitle ? (
          <span className="mt-3 line-clamp-3 block text-footnote text-muted-foreground">
            {item.subtitle}
          </span>
        ) : null}
        <span className="mt-4 inline-flex items-center gap-1.5 text-footnote font-semibold">
          Open brand
          <ArrowRight
            aria-hidden
            className="size-4 transition-transform group-hover:translate-x-0.5"
            strokeWidth={1.75}
          />
        </span>
      </button>
      {open && slug ? (
        <BrandSheet brand={{ slug, name: item.title }} onClose={() => setOpen(false)} />
      ) : null}
    </>
  )
}

function NicheTile({ item }: { item: FeedItem }) {
  const label = typeof item.meta.label === "string" ? item.meta.label : "Related"
  const slug = typeof item.meta.slug === "string" ? item.meta.slug : item.id
  return (
    <Link href={item.url} transitionTypes={["nav-forward"]} className="group block">
      <span className="relative block aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt=""
            fill
            sizes="(min-width: 1280px) 22vw, (min-width: 640px) 33vw, 90vw"
            unoptimized
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <Cover
            palette={["#0a0a0a", "#222", "#555", "#aaa", "#eee"]}
            seed={slug}
            className="absolute inset-0"
          />
        )}
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
        />
        <span className="absolute top-3 left-3 rounded-full bg-black/40 px-2.5 py-1 text-overline font-medium text-white uppercase backdrop-blur-md">
          {label}
        </span>
        <span className="absolute inset-x-4 bottom-3 font-serif text-title-2 leading-none text-white italic">
          {item.title}
        </span>
      </span>
      {item.subtitle ? (
        <span className="mt-2 line-clamp-2 block px-0.5 text-footnote text-muted-foreground">
          {item.subtitle}
        </span>
      ) : null}
    </Link>
  )
}

function PromptCard({ item }: { item: FeedItem }) {
  const action = typeof item.meta.action === "string" ? item.meta.action : "Open"
  return (
    <Link
      href={item.url}
      transitionTypes={["nav-forward"]}
      className="group block rounded-2xl bg-foreground p-5 text-background transition-transform active:scale-[0.99]"
    >
      <span className="block font-serif text-title-2 leading-tight italic">{item.title}</span>
      {item.subtitle ? (
        <span className="mt-1.5 block text-callout opacity-75">{item.subtitle}</span>
      ) : null}
      <span className="mt-4 inline-flex items-center gap-1.5 text-callout font-semibold">
        {action}
        <ArrowRight
          aria-hidden
          className="size-4 transition-transform group-hover:translate-x-0.5"
          strokeWidth={1.75}
        />
      </span>
    </Link>
  )
}
