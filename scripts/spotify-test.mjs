// pnpm test:spotify [baseUrl]
//
// The Spotify test: on the first two screens of today's issue, music may take
// at most 20% of the area. Measures every [data-kind="music"] element's
// visible area within the top two viewport heights, at phone and desktop
// widths, for a new visitor and a seeded one. Exits 1 on failure.
import { chromium } from "playwright-core"

const BASE = process.argv[2] ?? "http://localhost:3000"
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe"
const LIMIT = 0.2
const now = Date.now()
const sig = (kind, entity, label, hoursAgo) => ({
  kind,
  entity,
  label,
  strength: 1,
  at: now - hoursAgo * 3600_000,
})
const SEEDED = {
  signals: [
    sig("follow", "niche:jerk", "jerk", 5),
    sig("play_through", "artist:nettspend", "Nettspend", 3),
    sig("play_through", "artist:fakemink", "fakemink", 2),
    sig("save", "brand:rick-owens", "Rick Owens", 1),
  ],
  seen: [],
  syncedAt: 0,
}

const browser = await chromium.launch({ executablePath: CHROME })
let failed = false
try {
  for (const [persona, taste] of [
    ["new visitor", null],
    ["seeded", SEEDED],
  ]) {
    for (const [width, height, mobile] of [
      [390, 844, true],
      [1440, 900, false],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        isMobile: mobile,
        hasTouch: mobile,
        colorScheme: "dark",
      })
      if (taste) {
        await context.addInitScript(
          (s) => localStorage.setItem("subcult-taste-v1", JSON.stringify(s)),
          taste,
        )
      }
      const page = await context.newPage()
      await page.goto(BASE, { waitUntil: "networkidle", timeout: 180_000 })
      await page.locator('[data-testid="issue"]').waitFor({ timeout: 120_000 })
      await page.waitForTimeout(1500)
      const share = await page.evaluate(() => {
        const vw = window.innerWidth
        const limit = window.innerHeight * 2
        let music = 0
        for (const el of document.querySelectorAll('[data-kind="music"]')) {
          // Nested music elements count once: skip any inside another music element.
          if (el.parentElement?.closest('[data-kind="music"]')) continue
          const r = el.getBoundingClientRect()
          const top = Math.max(0, r.top + window.scrollY)
          const bottom = Math.min(limit, r.bottom + window.scrollY)
          const left = Math.max(0, r.left)
          const right = Math.min(vw, r.right)
          if (bottom > top && right > left) music += (bottom - top) * (right - left)
        }
        return music / (vw * limit)
      })
      const ok = share <= LIMIT
      if (!ok) failed = true
      console.log(
        `${ok ? "pass" : "FAIL"}  ${persona.padEnd(12)} ${String(width).padStart(4)}px  music ${(share * 100).toFixed(1)}% of the first two screens (limit ${LIMIT * 100}%)`,
      )
      await context.close()
    }
  }
} finally {
  await browser.close()
}
process.exit(failed ? 1 : 0)
