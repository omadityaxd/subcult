import { describe, expect, it } from "vitest"
import { videoFrameWidth, youtubeCrop } from "./youtube-crop"

const YT = "https://i.ytimg.com/vi/abc123/hqdefault.jpg"
const MAX = "https://i.ytimg.com/vi/abc123/maxresdefault.jpg"

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

  it("zooms a Short's 1280px frame to its video column; a regular one has no bars", () => {
    expect(youtubeCrop(MAX, { short: true, frame: "portrait" })).toBe("scale-[1.42]")
    expect(youtubeCrop(MAX, { short: true, frame: "landscape" })).toBe("scale-[3.16]")
    expect(youtubeCrop(MAX, { short: true, frame: "portrait-then-landscape" })).toBe(
      "scale-[1.42] md:scale-[3.16]",
    )
    expect(youtubeCrop(MAX, { frame: "portrait" })).toBe("")
  })
})

describe("videoFrameWidth", () => {
  it("counts only the pixels that are video", () => {
    expect(videoFrameWidth({ imageUrl: MAX, short: false, width: 1280 })).toBe(1280)
    expect(videoFrameWidth({ imageUrl: MAX, short: true, width: 1280 })).toBe(405)
    expect(videoFrameWidth({ imageUrl: YT, short: true, width: 480 })).toBe(202)
    expect(videoFrameWidth({ imageUrl: "https://img/x.jpg", short: false, width: 900 })).toBe(900)
  })
})
