import type { FitPiece, FitSong } from "@/db/schema"

/** A fit as the client sees it: public fields only, image as a URL. */
export interface FitView {
  id: string
  handle: string
  imageUrl: string
  width: number
  height: number
  caption: string | null
  niches: { slug: string; name: string }[]
  brands: { slug: string; name: string }[]
  pieces: FitPiece[]
  song: FitSong | null
  likeCount: number
  createdAt: string
  /** The viewer's own state (false when signed out). */
  liked: boolean
  saved: boolean
  mine: boolean
}
