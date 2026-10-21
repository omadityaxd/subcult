# Launch checklist

The exact order for the first Vercel deploy. Do the steps top to bottom; the ⟳ marks are the
redeploys. Key-by-key signup steps are in [KEYS.md](KEYS.md).

## 0. Before Vercel (local)

- [ ] `pnpm db:migrate` against the Supabase project you'll launch on (migrations up to
      `0011_private_fits_profiles` are already applied to the current one).
- [ ] `pnpm test`, `pnpm run test:security`, `pnpm run security:audit` all pass.
- [ ] Generate two secrets, each 32+ random bytes (keep them out of chat and git):
      `openssl rand -base64 32` → `ADMIN_SECRET`, run again → `CRON_SECRET`.

## 1. Create the Vercel project

- [ ] Vercel → Add New → Project → import `omadityaxd/subcult`. Framework: Next.js (auto).
      Build command and output: defaults. Install: pnpm (from `packageManager`).
- [ ] Region comes from `vercel.json` (`bom1`). See "Region" at the bottom before launch.
- [ ] Settings → Deployment Protection: **Vercel Authentication on for Preview** (so preview URLs
      aren't public).

## 2. Environment variables (first pass)

Set each one for **Production only** (untick Preview and Development). See section 6 for why.

| Variable                                                        | Value comes from                                                          | Needed for                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                      | Supabase → Project Settings → API → Project URL                           | Sign-in                                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                          | Supabase → Project Settings → API Keys → publishable (`sb_publishable_…`) | Sign-in                                              |
| `SUPABASE_SECRET_KEY`                                           | Supabase → API Keys → secret (`sb_secret_…`)                              | Posting fits, account deletion                       |
| `DATABASE_URL`                                                  | Supabase → Connect → **Transaction pooler** URI (port 6543)               | Accounts, fits, alerts                               |
| `DIRECT_URL`                                                    | not needed on Vercel (migrations run locally)                             | —                                                    |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`            | Upstash → your Redis → REST API                                           | Cache, quotas, rate limits                           |
| `ADMIN_SECRET`                                                  | generated in step 0                                                       | **Required**: production refuses to start without it |
| `CRON_SECRET`                                                   | generated in step 0                                                       | **Required**: production refuses to start without it |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`                    | developer.spotify.com → your app → Settings                               | Sounds                                               |
| `YOUTUBE_API_KEY`                                               | Google Cloud → APIs & Services → Credentials                              | Fit checks, videos                                   |
| `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`                          | developer.ebay.com → Application Keys → **Production** keyset             | Archive, grails                                      |
| `EBAY_CAMPAIGN_ID` (optional)                                   | eBay Partner Network                                                      | Affiliate links                                      |
| `ANTHROPIC_API_KEY`                                             | console.anthropic.com → API Keys                                          | Vision tags, new niches, blurbs                      |
| `UNSPLASH_ACCESS_KEY`                                           | unsplash.com/developers → your app                                        | Moodboard photos                                     |
| `PEXELS_API_KEY`                                                | pexels.com/api                                                            | Moodboard photos                                     |
| `ARENA_ACCESS_TOKEN` (optional)                                 | are.na → settings → applications                                          | Higher Are.na limit                                  |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`           | PostHog → Project settings (`https://us.i.posthog.com` or EU)             | Analytics, errors                                    |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`             | the pair already in `.env.local` (or `npx web-push generate-vapid-keys`)  | Push alerts                                          |
| `CONTACT_EMAIL`                                                 | an inbox you read                                                         | Legal pages (needed for launch)                      |
| `LLM_DAILY_GENERATION_CAP`, `VISION_DAILY_BATCH_CAP` (optional) | defaults 30 and 60                                                        | Cost caps                                            |
| `AMAZON_DOMAIN`, `AMAZON_AFFILIATE_TAG` (optional)              | Amazon Associates                                                         | Shop links                                           |
| `NEXT_PUBLIC_SPOTIFY_CONNECT` (optional)                        | `1` to show Spotify Connect                                               | Full songs (Premium, 5 test users)                   |
| `NEXT_PUBLIC_SITE_URL`                                          | **leave unset for now**: set after step 3                                 | Share/OG links                                       |

`NEXT_PUBLIC_*` values are baked in at build time: changing one needs a redeploy.

## 3. ⟳ First deploy

- [ ] Deploy. Note the production URL: `https://<project>.vercel.app` (or your custom domain if
      you add one now: Settings → Domains).
- [ ] Without `NEXT_PUBLIC_SITE_URL`, links use Vercel's production URL automatically, so this
      deploy already works.

## 4. Settings that need the production URL

Replace `<url>` with `https://<project>.vercel.app` (or your domain).

- [ ] **Supabase → Authentication → URL Configuration**
  - Site URL: `<url>`
  - Redirect URLs: add `<url>/auth/callback` (exact, no wildcards). Keep
    `http://localhost:3000/auth/callback` only if you still sign in locally.
- [ ] **Google Cloud → APIs & Services**
  - OAuth consent screen: home page `<url>/about`, privacy `<url>/privacy`, terms `<url>/terms`;
    authorized domain: your domain (and `supabase.co`). Publish the app (out of Testing).
  - Credentials → your OAuth client: **Authorized redirect URI stays**
    `https://<project-ref>.supabase.co/auth/v1/callback` (Supabase handles the callback; it doesn't
    change with your URL). Authorized JavaScript origins: add `<url>`.
- [ ] **Spotify Developer Dashboard** → your app → Settings → Redirect URIs: add
      `<url>/spotify/callback`. Only matters if `NEXT_PUBLIC_SPOTIFY_CONNECT=1`; the Web API
      search keys need no redirect URI.
- [ ] **eBay**: Marketplace Account Deletion → declare the exemption (subcult stores no eBay user
      data). No URL needed for the exemption.
- [ ] **Vercel env**: set `NEXT_PUBLIC_SITE_URL=<url>` (only needed for a custom domain; harmless
      otherwise).

## 5. ⟳ Redeploy and smoke test

- [ ] Redeploy (Deployments → … → Redeploy) so `NEXT_PUBLIC_SITE_URL` is baked in.
- [ ] `<url>/admin/status` (any username, password `ADMIN_SECRET`): every service you set shows on.
- [ ] Sign in with Google and with a magic link; pick a handle (13+ box); post a fit; delete it.
- [ ] Me → Your data → Download works; delete a throwaway account end to end.
- [ ] Play a track; open a niche; run the vibe check; ⌘K search.
- [ ] Vercel → Settings → Cron Jobs: run `keep-alive` once manually; it returns 200.
- [ ] Share a niche link in a chat app: the OG card renders.
- [ ] `<url>/robots.txt` and `<url>/sitemap.xml` show the production URL.

Redeploy again any time you change a `NEXT_PUBLIC_*` value or add a key (server keys apply on the
next deploy too).

## 6. Preview deployments

Every branch push makes a preview deployment. If previews get the production env vars, a preview
build (any branch, any experiment) reads and writes real users' data with the secret key.

**Recommended: Production-only env vars.** Set every variable above with only "Production"
ticked. Previews then run with no keys, which this app is built for: no database, no sign-in, no
paid APIs, designed fallbacks everywhere, admin 404 and cron 401. Previews are for checking layout
and copy, and nothing in them can touch user data or spend quota.

- If you already added variables to all environments: Settings → Environment Variables → edit each
  → untick Preview and Development.
- CLI equivalent: `vercel env add NAME production`.

**If you want working previews later:** create a second free Supabase project and a second Upstash
database, run `pnpm db:migrate` against it, and set only those (plus test-mode or empty API keys)
for Preview. Never give Preview the production `DATABASE_URL`, `SUPABASE_SECRET_KEY` or Upstash
token. Preview URLs can't sign in against the production Supabase anyway: they aren't in its
redirect allowlist, and should stay out of it.

## Plan limits (checked against Vercel's docs, Oct 2026)

- **Crons:** Hobby allows 100 jobs, each at most once a day, firing anywhere within the scheduled
  hour. All four fit: keep-alive daily, rising daily, alerts daily, trends on the 1st and 15th.
  (The daily alert digest is part of the alerts job.)
- **Function duration:** Hobby's maximum is 300s; the three long crons set `maxDuration = 300` and
  keep their own deadlines under it.
- **Region:** Hobby runs functions in one region, which you can choose; `bom1` is allowed.
- **Body size:** 4.5 MB per request. Phones resize a fit to a ~1440px WebP (a few hundred KB)
  before upload; a photo the browser can't decode is sent as is and capped at 4 MB, with a clear
  message instead of Vercel's error.

## Before launch: two things to decide

- **Region:** the database is in Tokyo (`ap-northeast-1`), functions are in Mumbai (`bom1`). Every
  query crosses that gap (roughly 100 ms or more each way), and pages make several. Moving functions next to the
  database (`hnd1`) is usually faster even for readers in India. Change `regions` in
  `vercel.json` and measure both.
- **Alert timing:** the alerts job fires 14:00–14:59 UTC, which is 07:00 on the US West coast,
  inside the default quiet hours, so people there never get push alerts. Fine for an India-first
  launch; move it later if that changes.
