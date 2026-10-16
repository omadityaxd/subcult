import { describe, expect, it } from "vitest"
import { stripOutlet } from "./google-news"
import { decodeEntities, parseRss, summarize } from "./rss"

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
      imageUrl: null,
      summary: null,
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

const SCENE_FEED = `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>t</title>
  <item>
    <title>Rick Owens SS27</title>
    <link>https://hypebeast.com/2026/10/rick-owens-ss27</link>
    <description><![CDATA[<p><img width="620" src="https://image-cdn.hypb.st/a.jpg?w=800&amp;q=90" /></p><p><strong>Summary</strong></p><p>Rick Owens showed SS27 in Paris with towering platform boots and draped jersey, closing on a procession of monks.</p>]]></description>
  </item>
  <item>
    <title>Media tagged</title>
    <link>https://example.com/b</link>
    <media:content url="https://cdn.example.com/b.jpg" medium="image" />
  </item>
  <item>
    <title>Insecure image</title>
    <link>https://example.com/c</link>
    <enclosure url="http://cdn.example.com/c.jpg" type="image/jpeg" />
  </item>
</channel></rss>`

describe("parseRss images and ledes", () => {
  it("takes the publisher's image and a plain-text lede", () => {
    const [first, second, third] = parseRss(SCENE_FEED)
    expect(first.imageUrl).toBe("https://image-cdn.hypb.st/a.jpg?w=800&q=90")
    expect(first.summary).toMatch(/^Rick Owens showed SS27 in Paris/)
    expect(second.imageUrl).toBe("https://cdn.example.com/b.jpg")
    // Only https images: no mixed content.
    expect(third.imageUrl).toBeNull()
  })

  it("drops ledes that only repeat the headline (Google News)", () => {
    const title = "Gorpcore is everywhere this fall - Vogue"
    expect(summarize(`<a href="x">${title}</a>&nbsp;&nbsp;<font>Vogue</font>`, title)).toBeNull()
  })

  it("cuts long ledes at a word boundary", () => {
    const lede = summarize(`<p>${"word ".repeat(80)}</p>`, "t")
    expect(lede?.endsWith("…")).toBe(true)
    expect(lede?.length).toBeLessThanOrEqual(201)
  })
})
