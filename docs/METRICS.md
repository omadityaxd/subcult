# Metrics

Real numbers from friend testing, filled in by hand after the test window. **Leave a cell as "—"
until there's a measured number for it.** Every figure should be reproducible from the source
listed, and estimates are labeled as estimates.

**Test window:** — to — · **Build:** `git rev-parse --short HEAD` = — · **Testers invited:** —

## Headline numbers

| Metric               | Value | Definition                                                     | Source                                                 |
| -------------------- | ----- | -------------------------------------------------------------- | ------------------------------------------------------ |
| Users                | —     | Distinct people who opened the app at least once               | PostHog: unique users, any event                       |
| Signed-up accounts   | —     | Accounts with a handle                                         | `select count(*) from profiles`                        |
| Issues opened        | —     | Total issue opens (one per person per day at most)             | PostHog: `today_viewed` (total)                        |
| Issues per user      | —     | Issues opened ÷ users                                          | Derived                                                |
| D1 return            | —     | % of users who came back the day after their first visit       | PostHog retention, first event → any event, day 1      |
| D7 return            | —     | % of users who came back on day 7 (±0) after their first visit | PostHog retention, day 7                               |
| Plays                | —     | Track listens of 5 seconds or more (shorter is a skip)         | PostHog: `track_played` (total)                        |
| Plays per user       | —     | Plays ÷ users                                                  | Derived                                                |
| Vibe checks finished | —     | Completed vibe checks                                          | PostHog: `vibe_check_completed`                        |
| Fits posted          | —     | Fits created during the window (after moderation)              | `select count(*) from fits where created_at between …` |
| Grail alerts set     | —     | Active grail hunts                                             | `select count(*) from grail_searches`                  |

Event names follow `src/lib/analytics.ts`. Check them there before querying, and update this
table if they change.

## Funnels

| Funnel     | Steps                                                       | Conversion |
| ---------- | ----------------------------------------------------------- | ---------- |
| Activation | first visit → `onboarding_started` → `vibe_check_completed` | —          |
| Sign-up    | sign-in page viewed → signed in → handle chosen             | —          |
| Social     | `cop_or_drop` → `fit_posted`                                | —          |

## Quality

| Metric                               | Value | Source                              |
| ------------------------------------ | ----- | ----------------------------------- |
| Music preview match rate (15 niches) | —     | `pnpm run previews:rate`            |
| p75 LCP (mobile)                     | —     | Vercel Speed Insights               |
| Client errors per 100 sessions       | —     | PostHog exceptions ÷ sessions × 100 |
| API 5xx rate                         | —     | Vercel logs                         |

## What testers said

Short, attributed-by-initials quotes, with permission. No paraphrasing into praise.

- —

## Notes

What changed during the window (deploys, outages, a key added) that affects the numbers.

- —
