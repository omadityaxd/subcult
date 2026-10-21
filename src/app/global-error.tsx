"use client"

import { useEffect } from "react"
import { reportError } from "@/lib/analytics"

/**
 * The last resort, when the root layout itself fails: no fonts or theme
 * are guaranteed, so it carries its own minimal styling.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportError(error, error.digest ? { digest: error.digest } : undefined)
  }, [error])
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#0b0a10",
          color: "#f2f2f7",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <p style={{ fontSize: 34, fontStyle: "italic", fontFamily: "Georgia, serif", margin: 0 }}>
            subcult
          </p>
          <p style={{ marginTop: 16, fontSize: 17 }}>
            Something broke on our side. It&apos;s been reported.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              height: 44,
              padding: "0 20px",
              borderRadius: 999,
              border: 0,
              background: "#f2f2f7",
              color: "#0b0a10",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
