import type { FeedItem } from "@/lib/feed/types"
import type { Tag } from "./schema"

export interface TagRef {
  slug: string
  name: string
}

export interface TaggedItem {
  item: FeedItem
  tags: string[]
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Whole-word, case-insensitive keyword matchers ("fit" never matches "outfitter"). */
function matcher(tag: Pick<Tag, "keywords">): RegExp {
  return new RegExp(`\\b(${tag.keywords.map(escape).join("|")})\\b`, "i")
}

/**
 * Labels each feed item with the niche's tags whose keywords appear in its
 * title or subtitle. Returns only the tags that matched at least one item,
 * so the UI never offers a filter chip that empties the feed.
 */
export function tagFeedItems(
  items: readonly FeedItem[],
  tags: readonly Pick<Tag, "slug" | "name" | "keywords">[],
): { items: TaggedItem[]; tags: TagRef[] } {
  const matchers = tags.map((tag) => ({ tag, regex: matcher(tag) }))
  const tagged = items.map((item) => {
    const text = `${item.title} ${item.subtitle ?? ""}`
    return {
      item,
      tags: matchers.filter(({ regex }) => regex.test(text)).map(({ tag }) => tag.slug),
    }
  })
  const used = new Set(tagged.flatMap((entry) => entry.tags))
  return {
    items: tagged,
    tags: tags.filter((tag) => used.has(tag.slug)).map(({ slug, name }) => ({ slug, name })),
  }
}
