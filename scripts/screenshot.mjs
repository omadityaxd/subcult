// Screenshots at phone (390) and desktop (1440) widths with the system Chrome.
// Usage: node scripts/screenshot.mjs <outDir> <name>=<path>[|<tab name>] ...
// "|Fits" clicks the tab named Fits before the shot.
// Base URL from SCREENSHOT_BASE (default http://localhost:3000).
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { chromium } from "playwright-core"

const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe"
const BASE = process.env.SCREENSHOT_BASE ?? "http://localhost:3000"
const WIDTHS = [
  { width: 390, height: 844, mobile: true },
  { width: 1440, height: 900, mobile: false },
]

const [outDir, ...targets] = process.argv.slice(2)
if (!outDir || targets.length === 0) {
  console.error("usage: node scripts/screenshot.mjs <outDir> <name>=<path> ...")
  process.exit(1)
}
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ executablePath: CHROME })
try {
  for (const { width, height, mobile } of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: mobile ? 2 : 1,
      isMobile: mobile,
      hasTouch: mobile,
      colorScheme: "dark",
    })
    const page = await context.newPage()
    for (const target of targets) {
      const [name, rest] = target.split("=")
      const [path, tab] = rest.split("|")
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 90_000 })
      if (tab) {
        await page.getByRole("tab", { name: tab, exact: true }).first().click()
        await page.waitForLoadState("networkidle")
      }
      await page.waitForTimeout(2500)
      const file = join(outDir, `${name}-${width}.png`)
      await page.screenshot({ path: file, fullPage: process.env.FULL_PAGE === "1" })
      console.log(file)
    }
    await context.close()
  }
} finally {
  await browser.close()
}
