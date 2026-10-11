/** Shared by server (who-to-follow data) and client (the cards): no data imports here. */
export interface FollowCard {
  kind: "artist" | "brand"
  slug: string
  name: string
  handle: string
  imageUrl: string | null
  /** Where the handle was verified. */
  sources: string[]
}

export const instagramUrl = (handle: string) => `https://www.instagram.com/${handle}/`
