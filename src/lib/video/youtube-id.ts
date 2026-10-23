/**
 * A feed item's YouTube video id, from our item id or its URL (watch?v=,
 * youtu.be/, /shorts/, /embed/). Pure: used by server curation and the
 * client player alike.
 */
export function youtubeIdOf(item: { id: string; url: string }): string | null {
  const fromId = item.id.match(/^youtube:video:([\w-]{11})$/)?.[1]
  if (fromId) return fromId
  try {
    const url = new URL(item.url)
    if (url.hostname === "youtu.be") return url.pathname.slice(1, 12) || null
    if (!/(^|\.)youtube(-nocookie)?\.com$/.test(url.hostname)) return null
    const path = url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1]
    return path ?? url.searchParams.get("v")
  } catch {
    return null
  }
}
