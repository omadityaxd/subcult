import { XMLParser } from "fast-xml-parser"

export interface RssItem {
  title: string
  link: string
  publishedAt: Date | null
  /** Publisher name when the feed provides one (Google News does, via <source>). */
  source: string | null
  /** Publisher homepage from <source url="…"> (Google News), for allowlisting. */
  sourceUrl: string | null
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
    const title = text(item.title)
    const link = text(item.link)
    if (!title || !link || !/^https?:\/\//.test(link)) return []
    return [
      {
        title,
        link,
        publishedAt: parseDate(item.pubDate),
        source: text(item.source),
        sourceUrl: isRecord(item.source) ? text(item.source["@_url"]) : null,
      },
    ]
  })
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&apos;": "'",
}

/** Decodes the handful of HTML entities APIs like YouTube put in titles. */
export function decodeEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos|#39|#x27);/g, (entity) => ENTITIES[entity] ?? entity)
}
