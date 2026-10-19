"use client"

import Image, { type ImageProps } from "next/image"
import { cdnLoader, isResizable } from "@/lib/images/cdn"

/**
 * next/image with the CDN loader preset. A client component so server
 * components can use it too (they can't pass the loader function across).
 */
export function CdnImage(props: Omit<ImageProps, "loader" | "unoptimized">) {
  // Hosts without size variants load as-is: a srcset of identical URLs helps nobody.
  if (typeof props.src === "string" && !isResizable(props.src)) {
    // eslint-disable-next-line jsx-a11y/alt-text -- alt is required by ImageProps and passed through
    return <Image {...props} unoptimized />
  }
  // eslint-disable-next-line jsx-a11y/alt-text -- alt is required by ImageProps and passed through
  return <Image {...props} loader={cdnLoader} />
}
