import { containsTerm, isAmbiguous } from "@/lib/feed/relevance"

/**
 * Whether a headline counts toward a niche's own momentum: it names one of
 * the niche's verified entities, or the niche itself when that name isn't
 * an ordinary word. "Trap" in "a speed trap on the M25" is not the genre.
 */
export function countsForNiche(
  title: string,
  nicheName: string,
  namesEntity: (title: string) => boolean,
): boolean {
  if (namesEntity(title)) return true
  return !isAmbiguous(nicheName) && containsTerm(title, nicheName)
}
