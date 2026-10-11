/**
 * Feed item meta holds primitives only (it's cached as JSON), so related
 * niches travel as one string: "rage:rage|vamp:vamp".
 */
export interface RelatedNiche {
  slug: string
  name: string
}

export function encodeRelatedNiches(niches: readonly RelatedNiche[]): string {
  return niches.map(({ slug, name }) => `${slug}:${name.replace(/[|:]/g, " ")}`).join("|")
}

export function decodeRelatedNiches(value: unknown): RelatedNiche[] {
  if (typeof value !== "string" || value === "") return []
  return value.split("|").flatMap((pair) => {
    const [slug, name] = pair.split(":")
    return slug && name && /^[a-z0-9-]+$/.test(slug) ? [{ slug, name }] : []
  })
}
