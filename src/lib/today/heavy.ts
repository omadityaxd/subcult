/**
 * Heavy news: injuries, violence, deaths, legal trouble. It can run in The
 * Tea, but never as the issue's cover, its lead story or the login collage:
 * a magazine doesn't open on someone's worst day.
 *
 * Strong words are heavy on their own; softer ones ("court", "crash",
 * "died") only when the headline names a real person we know (one of our
 * verified artists), so "a crash course in archive Margiela" stays light.
 */
const STRONG =
  /\b(killed|murder(?:ed|s)?|shooting|shot dead|stabb(?:ed|ing)|overdos(?:e|ed)|indicted|sentenced|arrested|lawsuit|sued|rape|sexual assault|domestic violence)\b/i
const SOFT =
  /\b(dies|died|death|dead at|passed away|injur(?:ed|y|ies)|hospitali[sz]ed|crash(?:ed)?|court|trial|jail(?:ed)?|prison|police|assault(?:ed)?|attack(?:ed)?|brawl|fight|charges?|custody)\b/i
/** Slang and fashion terms that only look heavy. */
const DEFUSE =
  /\b(killed it|killing it|deadstock|dead stock|free trial|court(?:side|ney)|crash course|fight club)\b/gi

export function isHeavy(
  title: string,
  namesPerson: (title: string) => boolean = () => true,
): boolean {
  const text = title.replace(DEFUSE, " ")
  if (STRONG.test(text)) return true
  return SOFT.test(text) && namesPerson(title)
}
