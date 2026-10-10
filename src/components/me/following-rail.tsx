"use client"

import Image from "next/image"
import Link from "next/link"
import { SectionHeader } from "@/components/ds/section-header"
import { isFollow } from "@/lib/follows"
import { useSaves } from "@/lib/saves"

/** Niches you follow (stored on this device until accounts land). Hidden when empty. */
export function FollowingRail() {
  const follows = useSaves().filter(isFollow)
  if (follows.length === 0) return null
  return (
    <section>
      <SectionHeader title="Following" overline={`${follows.length} niches`} />
      <ul className="-mx-(--gutter) no-scrollbar flex gap-4 overflow-x-auto px-(--gutter) pb-1">
        {follows.map((niche) => (
          <li key={niche.id} className="w-20 shrink-0">
            <Link href={niche.url} className="group block text-center">
              <span className="relative mx-auto block size-20 overflow-hidden rounded-full bg-muted ring-1 ring-border-strong transition-transform group-active:scale-95">
                {niche.imageUrl ? (
                  <Image
                    src={niche.imageUrl}
                    alt=""
                    fill
                    sizes="80px"
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <span className="grid size-full place-items-center font-serif text-title-2 italic">
                    {niche.title.charAt(0)}
                  </span>
                )}
              </span>
              <span className="mt-2 block truncate text-footnote font-medium">{niche.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
