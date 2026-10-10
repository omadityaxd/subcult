"use client"

import Image from "next/image"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface MediaImageProps {
  src: string
  alt: string
  sizes: string
  className?: string
  priority?: boolean
}

/**
 * Remote artwork (album art, thumbnails) with blur-up loading: a shimmer
 * holds the space, the image fades and sharpens in on load. Fills its
 * (relatively positioned, sized) parent. Unoptimized: these hosts are
 * already CDNs and Vercel's optimizer quota is better spent elsewhere.
 */
export function MediaImage({ src, alt, sizes, className, priority }: MediaImageProps) {
  const [loaded, setLoaded] = useState(false)
  return (
    <>
      {!loaded ? <span aria-hidden className="absolute inset-0 shimmer" /> : null}
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        sizes={sizes}
        priority={priority}
        onLoad={() => setLoaded(true)}
        className={cn(
          "object-cover transition-[opacity,filter,scale] duration-500 ease-out",
          loaded ? "blur-0 scale-100 opacity-100" : "scale-[1.03] opacity-0 blur-md",
          className,
        )}
      />
    </>
  )
}
