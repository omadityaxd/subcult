"use client"

import { useEffect, useState } from "react"

const SAMPLE = 24
const FALLBACK = "#8a8a8a"
const cache = new Map<string, string>()

type Rgb = [number, number, number]

const toHex = ([r, g, b]: Rgb) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`

/**
 * The art's most vivid (saturated, mid-bright) colour, averaged over the
 * pixels close to it. Pure function over RGBA bytes, so it's testable.
 */
export function pickAccent(pixels: Uint8ClampedArray): string {
  let best: Rgb | null = null
  let bestScore = -1
  const samples: Rgb[] = []
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue
    const rgb: Rgb = [pixels[i], pixels[i + 1], pixels[i + 2]]
    samples.push(rgb)
    const max = Math.max(...rgb)
    const min = Math.min(...rgb)
    const saturation = max === 0 ? 0 : (max - min) / max
    const lightness = (max + min) / 510
    // Prefer colourful, not near-black or near-white.
    const score = saturation * (1 - Math.abs(lightness - 0.55) * 1.6)
    if (score > bestScore) {
      bestScore = score
      best = rgb
    }
  }
  if (!best || bestScore < 0.12) {
    // Greyscale art: use a neutral derived from the average brightness.
    if (samples.length === 0) return FALLBACK
    const avg = samples.reduce((sum, [r, g, b]) => sum + (r + g + b) / 3, 0) / samples.length
    const v = Math.min(200, Math.max(110, avg))
    return toHex([v, v, v])
  }
  const anchor = best
  const near = samples.filter(
    ([r, g, b]) => Math.abs(r - anchor[0]) + Math.abs(g - anchor[1]) + Math.abs(b - anchor[2]) < 90,
  )
  const mean = near.reduce<Rgb>((sum, [r, g, b]) => [sum[0] + r, sum[1] + g, sum[2] + b], [0, 0, 0])
  return toHex([mean[0] / near.length, mean[1] / near.length, mean[2] / near.length])
}

function extract(url: string): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = "anonymous" // Spotify and Apple artwork CDNs send CORS headers.
    image.decoding = "async"
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = SAMPLE
        canvas.height = SAMPLE
        const context = canvas.getContext("2d", { willReadFrequently: true })
        if (!context) return resolve(FALLBACK)
        context.drawImage(image, 0, 0, SAMPLE, SAMPLE)
        resolve(pickAccent(context.getImageData(0, 0, SAMPLE, SAMPLE).data))
      } catch {
        resolve(FALLBACK) // tainted canvas or decode failure
      }
    }
    image.onerror = () => resolve(FALLBACK)
    image.src = url
  })
}

/** Accent colour for a piece of album art (cached per URL). */
export function useArtworkColor(url: string | null | undefined): string {
  // Bumped when an extraction lands, to re-read the module cache.
  const [, setVersion] = useState(0)
  useEffect(() => {
    if (!url || cache.has(url)) return
    let cancelled = false
    void extract(url).then((next) => {
      cache.set(url, next)
      if (!cancelled) setVersion((version) => version + 1)
    })
    return () => {
      cancelled = true
    }
  }, [url])
  return (url && cache.get(url)) || FALLBACK
}
