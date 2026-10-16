/**
 * pnpm today:shots [baseUrl]
 *
 * Today for three people side by side: a brand-new user and two seeded test
 * users with different tastes. Prints each one's top-10 affinity entities
 * and saves 390/1440 screenshots to docs/screenshots/today/.
 */
import { mkdirSync } from "node:fs"
import { chromium } from "playwright-core"
import { computeAffinity, topEntities, type Signal } from "../src/lib/taste/model"

const BASE = process.argv[2] ?? "http://localhost:3000"
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe"
const OUT = "docs/screenshots/today"
const now = Date.now()
const HOUR = 3600_000

const s = (
  kind: Signal["kind"],
  entity: Signal["entity"],
  label: string,
  hoursAgo: number,
  strength = 1,
): Signal => ({ kind, entity, label, strength, at: now - hoursAgo * HOUR })

const PERSONAS: Record<string, Signal[]> = {
  "new-user": [],
  "jerk-kid": [
    s("vibe_check", "niche:jerk", "jerk", 100, 0.6),
    s("vibe_check", "niche:new-gen-underground-rap", "new-gen underground rap", 100, 0.4),
    s("play_through", "artist:nettspend", "Nettspend", 30),
    s("play_through", "artist:nettspend", "Nettspend", 20),
    s("play_through", "artist:fakemink", "fakemink", 10),
    s("play", "artist:evilgiane", "evilgiane", 8),
    s("save", "brand:rick-owens", "Rick Owens", 6),
    s("save", "brand:chrome-hearts", "Chrome Hearts", 5),
    s("follow", "niche:jerk", "jerk", 4),
    s("follow", "niche:archive-fashion", "archive fashion", 3),
  ],
  "sad-academic": [
    s("vibe_check", "niche:dark-academia", "dark academia", 120, 0.5),
    s("vibe_check", "niche:midwest-emo", "midwest emo", 120, 0.5),
    s("play_through", "artist:frederic-chopin", "Frédéric Chopin", 40),
    s("play_through", "artist:american-football", "American Football", 30),
    s("play", "artist:mitski", "Mitski", 20),
    s("follow", "niche:dark-academia", "dark academia", 10),
    s("follow", "niche:midwest-emo", "midwest emo", 9),
    s("not_my_vibe", "niche:rage", "rage", 5),
  ],
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true })
  for (const [name, signals] of Object.entries(PERSONAS)) {
    const top = topEntities(computeAffinity(signals, now), 10)
    console.log(`\n## ${name}: top ${top.length} affinity entities`)
    for (const a of top)
      console.log(`  ${a.score.toFixed(2).padStart(6)}  ${a.label} (${a.entity}, ${a.because})`)
  }
  const browser = await chromium.launch({ executablePath: CHROME })
  try {
    const only = process.env.ONLY
    for (const [name, signals] of Object.entries(PERSONAS)) {
      if (only && name !== only) continue
      for (const [width, height, mobile] of [
        [390, 844, true],
        [1440, 900, false],
      ] as const) {
        const context = await browser.newContext({
          viewport: { width, height },
          deviceScaleFactor: mobile ? 2 : 1,
          isMobile: mobile,
          hasTouch: mobile,
          colorScheme: "dark",
        })
        await context.addInitScript(
          ({ state, previous }) => {
            localStorage.setItem("subcult-taste-v1", JSON.stringify(state))
            if (previous) {
              localStorage.setItem(
                "subcult-visits-v1",
                JSON.stringify({ previous: null, current: previous }),
              )
            }
          },
          {
            state: { signals, seen: [], syncedAt: 0 },
            previous: signals.length > 0 ? now - 3 * 24 * HOUR : null,
          },
        )
        const page = await context.newPage()
        await page.goto(BASE, { waitUntil: "networkidle", timeout: 180_000 })
        await page.getByText("You're caught up").waitFor({ timeout: 120_000 })
        await page.waitForTimeout(2500)
        const today = page.locator('section[aria-label="Today"]')
        await today.screenshot({ path: `${OUT}/${name}-${width}.png` })
        console.log(`${OUT}/${name}-${width}.png`)
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
