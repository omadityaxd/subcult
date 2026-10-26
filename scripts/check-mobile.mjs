// Mobile layout guard: every page at 390px must be exactly as wide as the screen.
// A wider document (e.g. an absolutely positioned child escaping a horizontal
// scroller) makes phones zoom out or scroll sideways and puts taps in the wrong place.
// Every tappable element must also opt out of double-tap zoom (touch-action).
// Usage: node scripts/check-mobile.mjs [baseUrl] [path ...]
// Base URL defaults to http://localhost:3000; paths default to the main pages.
import { chromium } from "playwright-core"

const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe"
const [base = "http://localhost:3000", ...given] = process.argv.slice(2)
const PATHS = given.length
  ? given
  : [
      "/",
      "/explore",
      "/vibe-check",
      "/me",
      "/login",
      "/n/rage",
      "/n/vamp",
      "/n/jerk",
      "/n/tread",
      "/about",
      "/privacy",
      "/terms",
      "/content-policy",
      "/notifications",
      "/fits/new",
    ]

const browser = await chromium.launch({ executablePath: CHROME })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
let failures = 0
try {
  for (const path of PATHS) {
    const page = await context.newPage()
    await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 120_000 })
    await page.waitForTimeout(2000)
    const report = await page.evaluate(() => {
      const width = document.documentElement.scrollWidth
      if (width <= 391) return { width, culprits: [] }
      const wide = [...document.querySelectorAll("body *")].filter(
        (el) => el.getBoundingClientRect().right > 392,
      )
      const fixed = (el) => getComputedStyle(el).position === "fixed"
      const culprits = wide
        .filter((el) => !fixed(el) && !wide.some((o) => o !== el && o.contains(el)))
        .slice(0, 5)
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 4).join(".")}`)
      return { width, culprits }
    })
    const zoomable = await page.evaluate(() => {
      const tappable = [...document.querySelectorAll("a[href], button, input, select, textarea, [role=button]")]
      const bad = tappable.filter((el) => getComputedStyle(el).touchAction === "auto")
      return { total: tappable.length, bad: bad.length, sample: bad.slice(0, 3).map((el) => el.outerHTML.slice(0, 80)) }
    })
    const ok = report.width <= 391 && zoomable.bad === 0
    if (!ok) failures++
    console.log(`${ok ? "ok  " : "FAIL"} ${path} width=${report.width} double-tap-zoomable=${zoomable.bad}/${zoomable.total}`)
    for (const c of [...report.culprits, ...zoomable.sample]) console.log(`       ${c}`)
    await page.close()
  }
} finally {
  await browser.close()
}
process.exit(failures ? 1 : 0)
