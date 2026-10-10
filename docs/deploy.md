# Deploying subcult to Vercel

The repo deploys as a standard Next.js 16 app. Every integration is optional:
with no keys the app still runs on the bundled niche catalog, and each missing
key switches off one feature instead of crashing.

## 1. Import the project

1. In Vercel, choose **Add New → Project** and import `omadityaxd/subcult`.
2. Leave the defaults: Framework **Next.js**, Root directory `./`. Vercel
   detects pnpm from `pnpm-lock.yaml`; the build command is `pnpm build`.
3. **Region:** `vercel.json` pins functions to **`bom1` (Mumbai)**, next to
   Supabase and Upstash. After the first deploy, confirm it under
   Settings → Functions → Function Region.
4. Add the environment variables below (step 2) _before_ the first deploy.
   Set each one for **Production** and **Preview**.

## 2. Environment variables

| Variable                                               | Required?   | Where it comes from / notes                                                                                                                    |
| ------------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                         | Recommended | Supabase → Connect → **Transaction pooler** URI (port 6543). URL-encode any `$` in the password as **`%24`** (Next expands `$` in env values). |
| `DIRECT_URL`                                           | Optional    | Supabase **Session pooler** URI (port 5432), same `%24` rule. Only `pnpm db:migrate` uses it; migrations run from your machine.                |
| `NEXT_PUBLIC_SUPABASE_URL`                             | Optional    | Supabase → Project Settings → API.                                                                                                             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                 | Optional    | Same page (publishable key).                                                                                                                   |
| `SUPABASE_SECRET_KEY`                                  | Optional    | Same page (secret key). Server-only; never prefix with `NEXT_PUBLIC_`.                                                                         |
| `UPSTASH_REDIS_REST_URL`                               | Recommended | Upstash console → your database → REST API. Feed cache, quotas, rate limits, preview matches.                                                  |
| `UPSTASH_REDIS_REST_TOKEN`                             | Recommended | Same page.                                                                                                                                     |
| `SPOTIFY_CLIENT_ID`                                    | Recommended | Spotify developer dashboard. Client-credentials only, so no redirect URI is needed.                                                            |
| `SPOTIFY_CLIENT_SECRET`                                | Recommended | Same app.                                                                                                                                      |
| `YOUTUBE_API_KEY`                                      | Optional    | Google Cloud → YouTube Data API v3 key. Capped at 80 searches/day in code.                                                                     |
| `ANTHROPIC_API_KEY`                                    | Optional    | Enables summoning new niches and personalized Vibe Check blurbs. Without it, templates are used.                                               |
| `LLM_DAILY_GENERATION_CAP`                             | Optional    | Global LLM jobs per UTC day (niche generations + vibe blurbs). Default `30`.                                                                   |
| `ADMIN_SECRET`                                         | Optional    | Password for `/admin` (HTTP Basic, any username). Admin returns 404 when unset. Generate below.                                                |
| `CRON_SECRET`                                          | Recommended | Vercel sends `Authorization: Bearer $CRON_SECRET` to cron routes; they reject anything else. Generate below.                                   |
| `NEXT_PUBLIC_SITE_URL`                                 | Optional    | Only for a custom domain. Otherwise share links and OG images use the Vercel production URL automatically.                                     |
| `AMAZON_DOMAIN`                                        | Optional    | Storefront for shop links. Default `amazon.com`.                                                                                               |
| `AMAZON_AFFILIATE_TAG`                                 | Optional    | Amazon Associates tag.                                                                                                                         |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | Optional    | Analytics (Phase 8).                                                                                                                           |
| `TREND_TTL_DAYS`                                       | Optional    | Days a trending niche stays live. Default `42`.                                                                                                |
| `TREND_RUN_MAX_COST_USD`                               | Optional    | Budget per trend-engine run. Default `0.25`, max `5`.                                                                                          |
| `TREND_WEB_SEARCH`                                     | Optional    | `true` lets the trend engine use Claude's web search. Default `false`.                                                                         |

### Generating `CRON_SECRET` and `ADMIN_SECRET`

Run one of these twice (one value per secret) and paste each output into Vercel:

```bash
# macOS / Linux / Git Bash
openssl rand -base64 32

# any OS with Node
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

```powershell
# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Use a different value for each. Never commit them; `.env*` is gitignored and
only `.env.example` (no values) is tracked.

## 3. Database (one-time, from your machine)

With `.env.local` pointing at the same Supabase project:

```bash
pnpm db:migrate     # applies drizzle/ migrations (idempotent)
pnpm seed:niches    # upserts the 55 curated niches (idempotent: a second run changes nothing)
pnpm db:status      # row counts, RLS, applied migrations
```

## 4. After the first deploy

- **Cron jobs** (Settings → Cron Jobs; production only):
  - `/api/cron/keep-alive`: daily at 12:00 UTC. Pings Postgres so the free Supabase project doesn't pause.
  - `/api/cron/trends`: on the 1st and 15th at 09:00 UTC. Runs the trend engine within `TREND_RUN_MAX_COST_USD`.

  Both schedules fit the Hobby plan's limit of once a day.

- **Smoke test:**
  - `/` For You: stories play music after a tap.
  - `/explore`: the Underground hub card.
  - `/explore/underground`
  - `/n/rage`: the page HTML carries `data-niche-source="database"`.
  - `/vibe-check`: share a result and check the OG image.
  - `/admin/usage`
- **Spotify note:** Spotify dev-mode apps can be rate-limited for most of a
  day if hammered. The app honours `Retry-After` through a shared breaker and
  serves cached feeds meanwhile, so a block shows up as stale data, not errors.
