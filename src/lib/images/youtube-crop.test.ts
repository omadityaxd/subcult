import { describe, expect, it } from "vitest"
import { youtubeCrop } from "./youtube-crop"

const YT = "https://i.ytimg.com/vi/abc123/hqdefault.jpg"

describe("youtubeCrop", () => {
  it("zooms past the bars in portrait frames, for videos and Shorts alike", () => {
    expect(youtubeCrop(YT, { frame: "portrait" })).toBe("scale-[1.34]")
    expect(youtubeCrop(YT, { short: true, frame: "portrait" })).toBe("scale-[1.34]")
  })

  it("only zooms Shorts in landscape frames", () => {
    expect(youtubeCrop(YT, { frame: "landscape" })).toBe("")
    expect(youtubeCrop(YT, { short: true, frame: "landscape" })).toBe("scale-[2.4]")
  })

  it("switches at md for the responsive cover", () => {
    expect(youtubeCrop(YT, { frame: "portrait-then-landscape" })).toBe("scale-[1.34] md:scale-100")
    expect(youtubeCrop(YT, { short: true, frame: "portrait-then-landscape" })).toBe(
      "scale-[1.34] md:scale-[2.4]",
    )
  })

  it("leaves every other image alone", () => {
    expect(youtubeCrop("https://i.scdn.co/image/x", { frame: "portrait" })).toBe("")
    expect(youtubeCrop(null, { short: true, frame: "portrait" })).toBe("")
  })
})
