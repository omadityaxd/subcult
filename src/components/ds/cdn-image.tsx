"use client"

import Image, { type ImageProps } from "next/image"
import { useState } from "react"
import { cdnLoader, isResizable } from "@/lib/images/cdn"

/**
 * next/image with the CDN loader preset. A client component so server
 * components can use it too (they can't pass the loader function across).
 * An image that fails to load renders nothing, so whatever sits beneath it
 * (a generative cover, a monogram, a palette) shows instead of a broken icon.
 */
export function CdnImage(props: Omit<ImageProps, "loader" | "unoptimized">) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  const onError: ImageProps["onError"] = (event) => {
    setFailed(true)
    props.onError?.(event)
  }
  // Hosts without size variants load as-is: a srcset of identical URLs helps nobody.
  if (typeof props.src === "string" && !isResizable(props.src)) {
    // eslint-disable-next-line jsx-a11y/alt-text -- alt is required by ImageProps and passed through
    return <Image {...props} onError={onError} unoptimized />
  }
  // eslint-disable-next-line jsx-a11y/alt-text -- alt is required by ImageProps and passed through
  return <Image {...props} onError={onError} loader={cdnLoader} />
}
