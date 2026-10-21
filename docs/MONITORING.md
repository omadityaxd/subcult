# Monitoring

Errors and product analytics both go to PostHog (free tier: 1M events and 100K exceptions a month). Nothing is sent until `NEXT_PUBLIC_POSTHOG_KEY` is set; `pnpm run doctor` shows whether it is.

## Errors

- **Unhandled errors** in the browser (exceptions and promise rejections) are captured automatically (`capture_exceptions: true` in `lib/analytics.ts`).
- **Handled errors** go through `reportError(error, context)`:
  - a page that fails to render (`app/error.tsx`, `app/global-error.tsx`, with Next's digest so you can find the server log),
  - a section that fails on its own (`SectionBoundary`, tagged with the section: "The Tea", "The archive"…). The rest of the page keeps working.
- **Server errors** are structured JSON logs (`lib/log.ts`) in Vercel's runtime logs. Search by event name, e.g. `today.ssr_failed`, `search.source_failed`, `image.analyze_failed`.

To check it works after adding the key: open the site, run `throw new Error("posthog check")` in the browser console, and look under PostHog → Error tracking.

## Funnels to create

Create these in PostHog → Product analytics → New insight → Funnel. Event properties are counts and slugs only, never free text or identities.

| Funnel | Steps (in order) | What it tells you |
|---|---|---|
| First-run | `onboarding_started` → `vibe_check_completed` → `onboarding_completed` → `today_viewed` | Where new people drop out before their first issue |
| Daily habit | `today_viewed` → `today_caught_up` | Whether people read the issue to the back page |
| Engagement | `today_viewed` → `cop_or_drop` | Whether the issue gets a reaction |
| Grail hunters | `today_viewed` → `grail_hunt_saved` → `alert_opt_in` | Whether hunts turn into push opt-ins |
| Social | `vibe_check_completed` → `vibe_match_shared` | Whether results get shared |
| Creators | `onboarding_completed` → `fit_posted` | Whether new people post a fit |

Also worth a trend chart:

- `today_viewed` by day: daily readers (D1 and D7 return come from PostHog's Retention insight on this event)
- `poll_voted`
- `cop_or_drop` broken down by `kind`

## Alerts

- **Cost:** `/admin/status` lists every paid or quota-limited call with today's usage against its cap. `/admin/usage` has LLM spend.
- **Health:** `/admin/status` (or `pnpm run doctor` locally) pings every service.
