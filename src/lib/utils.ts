import { createCn } from "cn/config"

/**
 * The design system's type scale (globals.css --text-*). Without this, the
 * class merger reads `text-callout` as a text colour and drops the real
 * colour beside it (every primary Button lost `text-background`).
 */
const TYPE_SCALE = [
  "display",
  "title-1",
  "title-2",
  "title-3",
  "headline",
  "body",
  "callout",
  "footnote",
  "caption",
  "overline",
]

export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: TYPE_SCALE }] } },
})
