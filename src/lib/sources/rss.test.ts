import { describe, expect, it } from "vitest"
import { stripOutlet } from "./google-news"
import { decodeEntities, parseRss } from "./rss"

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>t</title>
  <item>
    <title>Gorpcore is everywhere this fall - Vogue</title>
    <link>https://news.google.com/articles/abc</link>
    <pubDate>Wed, 08 Oct 2026 14:00:00 GMT</pubDate>
    <source url="https://www.vogue.com">Vogue</source>
  </item>
  <item>
    <title>No link, should be skipped</title>
  </item>
  <item>
    <title>Bad scheme</title>
    <link>javascript:alert(1)</link>
  </item>
</channel></rss>`

describe("parseRss", () => {
  it("parses valid items and skips malformed ones", () => {
    const items = parseRss(FEED)
    expect(items).toHaveLength(1)
    expect(items[0]).toEqual({
      title: "Gorpcore is everywhere this fall - Vogue",
      link: "https://news.google.com/articles/abc",
      publishedAt: new Date("2026-10-08T14:00:00.000Z"),
      source: "Vogue",
      sourceUrl: "https://www.vogue.com",
    })
  })

  it("returns an empty list for garbage or a non-RSS document", () => {
    expect(parseRss("not xml at all <<<")).toEqual([])
    expect(parseRss("<html><body>hi</body></html>")).toEqual([])
  })

  it("handles a single-item feed", () => {
    const one = `<rss><channel><item><title>Solo</title><link>https://x.dev/a</link></item></channel></rss>`
    expect(parseRss(one).map((item) => item.title)).toEqual(["Solo"])
  })
})

describe("stripOutlet", () => {
  it("removes Google News' trailing ' - Outlet'", () => {
    expect(stripOutlet("Gorpcore is everywhere - Vogue", "Vogue")).toBe("Gorpcore is everywhere")
    expect(stripOutlet("No outlet here", null)).toBe("No outlet here")
  })
})

describe("decodeEntities", () => {
  it("decodes the common entities", () => {
    expect(decodeEntities("Tyler&#39;s &quot;fit&quot; &amp; more")).toBe(`Tyler's "fit" & more`)
  })
})
