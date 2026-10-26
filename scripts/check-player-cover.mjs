// With the mini-player showing at 390px, no button may sit under it (or under any other
// fixed layer) at the top or the bottom of each page.
// Usage: node scripts/check-player-cover.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright-core"
import sharp from "sharp"
const BASE = process.argv[2] ?? "http://localhost:3000"
const OUT = process.argv[3]
const PATHS = [
  "/",
  "/explore",
  "/me",
  "/n/rage",
  "/n/vamp",
  "/fits/new",
  "/notifications",
  "/start",
  "/explore/underground-internet-culture",
  "/about",
  "/privacy",
]
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--autoplay-policy=no-user-gesture-required"],
})
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 120000 })
const row = page.locator("[data-testid=issue] section[data-kind=music] li button").nth(1)
await row.waitFor({ state: "attached", timeout: 120000 })
await row.evaluate((el) => el.click()) // start a track so the mini-player shows
await page.waitForTimeout(4000)

const covered = () =>
  page.evaluate(() => {
    const fixedLayers = [...document.querySelectorAll("body *")].filter((el) => {
      const s = getComputedStyle(el)
      return (
        s.position === "fixed" &&
        s.visibility !== "hidden" &&
        Number(s.opacity) > 0.05 &&
        el.getBoundingClientRect().height > 0 &&
        el.getBoundingClientRect().height < innerHeight * 0.6
      )
    })
    const label = (el) =>
      (el.getAttribute("aria-label") || el.textContent || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 40)
    const out = []
    const targets = [
      ...document.querySelectorAll(
        "button, a[href], input, textarea, select, [role=button], [role=switch]",
      ),
    ].filter((el) => {
      const r = el.getBoundingClientRect()
      return (
        r.width > 0 &&
        r.height > 0 &&
        r.bottom > 0 &&
        r.top < innerHeight &&
        getComputedStyle(el).visibility !== "hidden"
      )
    })
    for (const el of targets) {
      if (fixedLayers.some((layer) => layer.contains(el))) continue // part of a fixed layer itself
      const r = el.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y = r.top + r.height / 2
      if (y < 0 || y > innerHeight) continue
      const hit = document.elementFromPoint(x, y)
      if (!hit || el.contains(hit) || hit.contains(el)) continue
      const layer = fixedLayers.find((l) => l.contains(hit))
      if (layer)
        out.push(
          `"${label(el)}" under ${layer.tagName.toLowerCase()}.${String(layer.className).split(" ").slice(0, 3).join(".")}`,
        )
    }
    return out
  })

let failures = 0
for (const path of PATHS) {
  await page.evaluate((p) => window.next.router.push(p), path)
  await page.waitForURL((u) => u.pathname === path, { timeout: 60000 }).catch(() => {})
  await page.waitForLoadState("networkidle").catch(() => {})
  await page.waitForTimeout(2500)
  const player = await page.evaluate(
    () =>
      getComputedStyle(document.documentElement).getPropertyValue("--player-space") || "(unset)",
  )
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(700)
  }
  await page.waitForTimeout(1500)
  const atEnd = await page.evaluate(() =>
    Math.round(document.documentElement.scrollHeight - innerHeight - scrollY),
  )
  const problems = (await covered()).map((x) => x + ` (at page end, ${atEnd}px left to scroll)`)
  if (problems.length) failures++
  console.log(`${problems.length ? "FAIL" : "ok  "} ${path} (--player-space: ${player})`)
  for (const p of problems) console.log(`       ${p}`)
  if (OUT)
    await sharp(await page.screenshot())
      .jpeg({ quality: 70 })
      .toFile(`${OUT}/cover-${path.replace(/\//g, "_") || "home"}.jpg`)
}
await browser.close()
console.log(failures ? `${failures} page(s) with covered buttons` : "no covered buttons")
process.exit(failures ? 1 : 0)
