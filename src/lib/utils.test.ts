import { describe, expect, it } from "vitest"
import { cn } from "./utils"

describe("cn", () => {
  it("keeps a text colour next to a type-scale size (they're different properties)", () => {
    // The primary Button: its variant colour and its size used to cancel out.
    expect(cn("bg-foreground text-background", "h-10 text-callout")).toBe(
      "bg-foreground text-background h-10 text-callout",
    )
    expect(cn("text-muted-foreground text-footnote")).toBe("text-muted-foreground text-footnote")
  })

  it("still lets a later size or colour win over an earlier one", () => {
    expect(cn("text-callout", "text-footnote")).toBe("text-footnote")
    expect(cn("text-title-1", "text-title-3")).toBe("text-title-3")
    expect(cn("text-foreground", "text-background")).toBe("text-background")
  })
})
