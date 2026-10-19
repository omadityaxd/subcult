"use client"

import { CdnImage } from "@/components/ds/cdn-image"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface MediaImageProps {
  src: string
  alt: string
  sizes: string
  className?: string
  priority?: boolean
  /** CSS object-position keeping the subject in frame (see lib/images/curate focusOf). */
  focus?: string
}

/**
 * Remote artwork (album art, thumbnails) with blur-up loading: a shimmer
 * holds the space, the image fades and sharpens in on load. Fills its
 * (relatively positioned, sized) parent. No optimizer: the CDN loader asks
 * Spotify/iTunes/eBay/Unsplash/Pexels for the variant each srcset width needs.
 */
export function MediaImage({ src, alt, sizes, className, priority, focus }: MediaImageProps) {
  // Priority (above-the-fold) images paint immediately: no fade waiting on hydration.
  const [loaded, setLoaded] = useState(Boolean(priority))
  return (
    <>
      {!loaded ? <span aria-hidden className="absolute inset-0 shimmer" /> : null}
      <CdnImage
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        onLoad={() => setLoaded(true)}
        style={focus ? { objectPosition: focus } : undefined}
        className={cn(
          "object-cover transition-opacity duration-300 ease-out",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
      />
    </>
  )
}
