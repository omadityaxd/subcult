"use client"

import { getImageProps } from "next/image"
import { useState } from "react"
import { MediaImage } from "@/components/ds/media-image"
import { COVER_MOBILE_MAX_WIDTH, capSrcSet, isOptimizableCover } from "@/lib/images/cover-hosts"
import { cn } from "@/lib/utils"

const SIZES = "(max-width: 768px) 100vw, 1100px"

interface CoverImageProps {
  src: string
  alt: string
  /** Inline placeholder made on the server (lib/images/cover-blur.ts). */
  blur?: string | null
  /** CSS object-position keeping the subject in frame. */
  focus?: string
  className?: string
}

/**
 * The issue cover, the page's largest paint. Through the image optimizer
 * (WebP, cached), requested at high priority as soon as its HTML
 * arrives, and visible from the first paint (no fade waiting on JS). Phones
 * pick from variants up to ~750px wide whatever their pixel ratio. Hosts the
 * optimizer doesn't take keep the CDN-sized path.
 */
export function CoverImage({ src, alt, blur, focus, className }: CoverImageProps) {
  const [failed, setFailed] = useState(false)
  if (!isOptimizableCover(src)) {
    return (
      <MediaImage src={src} alt={alt} sizes={SIZES} priority focus={focus} className={className} />
    )
  }
  // Broken source: show nothing, so the container's background and the headline remain.
  if (failed) return null
  const { props } = getImageProps({
    src,
    alt,
    fill: true,
    sizes: SIZES,
    loading: "eager",
    fetchPriority: "high",
    placeholder: blur ? "blur" : "empty",
    blurDataURL: blur ?? undefined,
  })
  return (
    <picture>
      <source
        media="(max-width: 768px)"
        srcSet={capSrcSet(props.srcSet ?? "", COVER_MOBILE_MAX_WIDTH)}
        sizes="100vw"
      />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- getImageProps output; alt is in props */}
      <img
        {...props}
        onError={() => setFailed(true)}
        style={{ ...props.style, ...(focus ? { objectPosition: focus } : null) }}
        className={cn("object-cover", className)}
      />
    </picture>
  )
}
