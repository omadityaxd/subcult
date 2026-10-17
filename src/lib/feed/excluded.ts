import { containsTerm } from "./relevance"

/**
 * Content subcult never shows, anywhere: appearance rating, PED use and the
 * blackpill corner of "looksmaxxing" culture. Matched on whole words, in
 * every source's titles, and refused as a niche to generate. Regression-tested.
 */
export const EXCLUDED_EVERYWHERE: readonly string[] = [
  // hardmaxxing and rating culture
  "hardmaxxing",
  "hardmaxing",
  "psl",
  "psl rating",
  "rate my face",
  "face rating",
  "looks rating",
  "rating my face",
  "mogging",
  "mogged",
  "mogs",
  "looksmatch",
  "subhuman",
  "canthal tilt",
  "hunter eyes",
  // bonesmashing
  "bonesmashing",
  "bone smashing",
  "bonesmash",
  // steroids / PEDs / SARMs
  "steroids",
  "steroid",
  "peds",
  "sarms",
  "trenbolone",
  "tren",
  "anavar",
  "dianabol",
  "clenbuterol",
  "test cycle",
  "first cycle",
  "trt",
  // blackpill / incel
  "blackpill",
  "black pill",
  "incel",
  "incels",
  "redpill",
  "red pill",
]

/**
 * Glow-Up niches also exclude surgery promotion and extreme dieting. Scoped
 * to those niches because the words mean other things elsewhere ("anime
 * fillers", "fast fashion").
 */
export const EXCLUDED_IN_GLOW_UP: readonly string[] = [
  "jaw surgery",
  "leg lengthening",
  "rhinoplasty",
  "nose job",
  "bbl",
  "buccal fat",
  "canthoplasty",
  "fillers",
  "filler",
  "botox",
  "cosmetic surgery",
  "plastic surgery",
  "facial implants",
  "water fast",
  "water fasting",
  "dry fast",
  "dry fasting",
  "starving myself",
  "500 calories",
  "800 calories",
  "extreme diet",
  "crash diet",
]

export const GLOW_UP_HUB = "glow-up"

/** Topics we refuse to build a niche for (the generator says no, politely). */
export function isExcludedTopic(text: string): boolean {
  return [...EXCLUDED_EVERYWHERE, ...EXCLUDED_IN_GLOW_UP].some((term) => containsTerm(text, term))
}

export function isExcludedContent(text: string, { glowUp = false } = {}): boolean {
  const terms = glowUp ? [...EXCLUDED_EVERYWHERE, ...EXCLUDED_IN_GLOW_UP] : EXCLUDED_EVERYWHERE
  return terms.some((term) => containsTerm(text, term))
}
