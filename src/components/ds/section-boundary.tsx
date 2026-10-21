"use client"

import { RotateCw } from "lucide-react"
import { Component, type ReactNode } from "react"
import { reportError } from "@/lib/analytics"

interface SectionBoundaryProps {
  /** What the section is, for the fallback copy and the error report ("The Tea"). */
  label: string
  children: ReactNode
}

/**
 * One failing section never blanks the page: it shows a small panel with a
 * retry, reports the error, and everything around it keeps working.
 */
export class SectionBoundary extends Component<SectionBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    reportError(error, { section: this.props.label })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div
        role="status"
        className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-border-strong p-5"
      >
        <p className="text-callout text-muted-foreground">
          {this.props.label} didn&apos;t load this time.
        </p>
        <button
          type="button"
          onClick={() => this.setState({ failed: false })}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border-strong px-3 text-footnote font-semibold hover:bg-muted"
        >
          <RotateCw aria-hidden className="size-3.5" strokeWidth={1.75} />
          Try again
        </button>
      </div>
    )
  }
}
