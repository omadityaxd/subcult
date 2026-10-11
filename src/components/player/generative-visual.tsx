"use client"

import { useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** Hue-shifted variants of the accent so the blobs aren't one flat colour. */
function variants(hex: string): string[] {
  const [r, g, b] = hexToRgb(hex)
  return [
    `rgba(${r}, ${g}, ${b}, 0.85)`,
    `rgba(${Math.min(255, b + 40)}, ${r}, ${g}, 0.55)`,
    `rgba(${g}, ${Math.min(255, b + 30)}, ${r}, 0.45)`,
    `rgba(${Math.round(r * 0.4)}, ${Math.round(g * 0.4)}, ${Math.round(b * 0.4)}, 0.9)`,
  ]
}

/**
 * Slow, drifting colour fields drawn from the album art's accent, behind Now
 * Playing. ~30fps, paused when the tab is hidden, still under reduced motion.
 */
export function GenerativeVisual({ accent, className }: { accent: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return
    const colors = variants(accent)
    let raf = 0
    let last = 0
    const seeds = colors.map((_, i) => ({ phase: i * 1.7, speed: 0.00012 + i * 0.00004 }))

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = canvas.clientWidth * ratio
      canvas.height = canvas.clientHeight * ratio
    }
    const draw = (time: number) => {
      const { width, height } = canvas
      context.globalCompositeOperation = "source-over"
      context.fillStyle = "#050505"
      context.fillRect(0, 0, width, height)
      context.globalCompositeOperation = "lighter"
      seeds.forEach(({ phase, speed }, i) => {
        const t = time * speed + phase
        const x = width * (0.5 + 0.35 * Math.sin(t * 1.3 + i))
        const y = height * (0.45 + 0.35 * Math.cos(t * 0.9 + i * 2))
        const radius = Math.max(width, height) * (0.45 + 0.1 * Math.sin(t * 0.7))
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, colors[i])
        gradient.addColorStop(1, "rgba(0,0,0,0)")
        context.fillStyle = gradient
        context.fillRect(0, 0, width, height)
      })
    }
    const loop = (time: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden || time - last < 33) return
      last = time
      draw(time)
    }

    resize()
    window.addEventListener("resize", resize)
    if (reduceMotion) draw(0)
    else raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    }
  }, [accent, reduceMotion])

  return <canvas ref={canvasRef} aria-hidden className={className} />
}
