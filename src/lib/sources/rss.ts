import { XMLParser } from "fast-xml-parser"

export interface RssItem {
  title: string
  link: string
  publishedAt: Date | null
  /** Publisher name when the feed provides one (Google News does, via <source>). */
  source: string | null
  /** Publisher homepage from <source url="…"> (Google News), for allowlisting. */
  sourceUrl: string | null
  /** The publisher's own image: media:content/thumbnail, an image enclosure, or the first <img>. */
  imageUrl: string | null
  /** First ~200 chars of the description as plain text; null when it only repeats the title. */
  summary: string | null
}

const SUMMARY_MAX = 200
const IMG_SRC = /<img[^>]+src=["']([^"']+)["']/i

const httpsUrl = (value: string | null): string | null =>
  value && /^https:\/\//.test(value) ? value.replace(/&amp;/g, "&") : null

function attr(value: unknown, name: string): string | null {
  const node = Array.isArray(value) ? value[0] : value
  return isRecord(node) ? text(node[`@_${name}`]) : null
}

function imageOf(item: Record<string, unknown>, description: string | null): string | null {
  const enclosure = item.enclosure
  const enclosureType = attr(enclosure, "type") ?? ""
  return (
    httpsUrl(attr(item["media:content"], "url")) ??
    httpsUrl(attr(item["media:thumbnail"], "url")) ??
    (enclosureType.startsWith("image/") ? httpsUrl(attr(enclosure, "url")) : null) ??
    httpsUrl(description?.match(IMG_SRC)?.[1] ?? null)
  )
}

/** Plain-text lede from an HTML description, cut at a word boundary. */
export function summarize(description: string | null, title: string): string | null {
  if (!description) return null
  const plain = decodeEntities(
    description
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  )
    .replace(/^Summary\s+/i, "")
    .trim()
  if (plain.length < 40) return null
  const head = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  // Google News descriptions are just the headline again.
  if (head(plain).startsWith(head(title).slice(0, 60))) return null
  if (plain.length <= SUMMARY_MAX) return plain
  const cut = plain.slice(0, SUMMARY_MAX)
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.]$/, "")}…`
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (name) => name === "item",
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** Text content of an element that may be a plain string or {"#text": ...}. */
function text(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null
  if (typeof value === "number") return String(value)
  if (isRecord(value)) return text(value["#text"])
  return null
}

function parseDate(value: unknown): Date | null {
  const raw = text(value)
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Parses RSS 2.0. External data: everything is checked, malformed items are skipped. */
export function parseRss(xml: string): RssItem[] {
  let doc: unknown
  try {
    doc = parser.parse(xml)
  } catch {
    return []
  }
  if (!isRecord(doc) || !isRecord(doc.rss) || !isRecord(doc.rss.channel)) return []
  const items = doc.rss.channel.item
  if (!Array.isArray(items)) return []

  return items.flatMap((item): RssItem[] => {
    if (!isRecord(item)) return []
    const raw = text(item.title)
    const title = raw ? decodeEntities(raw) : null
    const link = text(item.link)
    if (!title || !link || !/^https?:\/\//.test(link)) return []
    return [
      {
        title,
        link,
        publishedAt: parseDate(item.pubDate),
        source: text(item.source),
        sourceUrl: isRecord(item.source) ? text(item.source["@_url"]) : null,
        imageUrl: imageOf(item, text(item.description)),
        summary: summarize(text(item.description), title),
      },
    ]
  })
}

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
}

const ENTITY = /&(#\d{1,7}|#x[0-9a-fA-F]{1,6}|[a-zA-Z]{2,8});/g

function decodeOnce(value: string): string {
  return value.replace(ENTITY, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole
    }
    return NAMED[body.toLowerCase()] ?? whole
  })
}

/**
 * Decodes HTML entities in titles: named, decimal and hex. Feeds often
 * double-encode ("&amp;#8211;"), so it runs until nothing changes (twice at most).
 */
export function decodeEntities(value: string): string {
  const once = decodeOnce(value)
  return once === value ? once : decodeOnce(once)
}
