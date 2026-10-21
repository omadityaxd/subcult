# Keys

subcult runs with zero keys and turns each feature on when its key is present. Adding a key in Vercel (Project → Settings → Environment Variables, scope **Production**) and redeploying is all it takes. Nothing else needs to change.

**Verify after every change:** run `pnpm run doctor` locally (it reads `.env.local`), or open `/admin/status` on production. Both show every service: key present, reachable, quota left, and on or off.

> `pnpm doctor` without `run` starts pnpm's own built-in doctor command, which takes priority over package scripts. Use `pnpm run doctor`.

Limits below were checked in October 2026; confirm on each provider's pricing page before relying on them.

## At a glance

| Service | Env vars | Unlocks | Free tier | Required |
|---|---|---|---|---|
| Postgres (Supabase) | `DATABASE_URL`, `DIRECT_URL` (migrations) | Accounts' data: taste sync, fits, follows, votes, alerts | 500 MB database, 2 active projects; pauses after a week idle | yes |
| Supabase Auth | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sign-in (Google, magic link) | 50,000 monthly active users | yes |
| Supabase secret key | `SUPABASE_SECRET_KEY` | Posting fits (photo uploads), account deletion | (same project) | no |
| Upstash Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Shared cache, rate limits, quotas, Rising | 500K commands/month, 256 MB | yes |
| eBay Browse API | `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` (+ optional `EBAY_CAMPAIGN_ID`) | The Grail, Archive tabs, shop the look, grail alerts | 5,000 calls/day per app | no |
| Anthropic | `ANTHROPIC_API_KEY` | Vision tagging (fits, pins, alt text), niche generation, vibe blurbs | pay as you go; capped in-app (below) | no |
| Spotify | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Exact Spotify links, artist images | free (development mode) | no |
| YouTube Data API | `YOUTUBE_API_KEY` | Videos, fit-check Shorts | 10,000 units/day (a search costs 100) | no |
| Unsplash | `UNSPLASH_ACCESS_KEY` | Moodboard photos | 50 requests/hour (demo), 5,000/hour once approved | no |
| Pexels | `PEXELS_API_KEY` | Moodboard photos | 200/hour, 20,000/month | no |
| Are.na | `ARENA_ACCESS_TOKEN` (optional) | Higher rate limit for moodboard channels | works without a token | no |
| PostHog | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Analytics and funnels | 1M events/month | no |
| Web push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Push alerts | free | no |
| Admin and cron | `ADMIN_SECRET`, `CRON_SECRET` | `/admin` (incl. status) and scheduled jobs | — | required in production |
| Site URL | `NEXT_PUBLIC_SITE_URL` | Absolute share and OG links, sitemap | — | no |
| Contact email | `CONTACT_EMAIL` | Shown on the legal pages for takedowns and questions | — | no |

## Step by step

### eBay (do this first)

1. Sign up at [developer.ebay.com](https://developer.ebay.com) and create an application.
2. Under **Application Keys**, create a **Production** keyset. Copy the **App ID (Client ID)** into `EBAY_CLIENT_ID` and the **Cert ID (Client Secret)** into `EBAY_CLIENT_SECRET`.
3. **Marketplace account deletion:** eBay disables production keys until you either subscribe to account-deletion notifications or claim an exemption. subcult only reads public listings and stores no eBay user data (listings are cached for hours, no seller or buyer accounts), so claim the exemption:
   - On the Application Keys page, follow the Marketplace Account Deletion notice next to the production keyset.
   - Pick the option to be exempted from (opt out of) the notifications, with the reason that the app doesn't store or retain eBay user data.
   - Save; the keyset activates. eBay's guide: [Marketplace user account deletion](https://developer.ebay.com/develop/guides/marketplace-user-account-deletion).
   - Answer truthfully: eBay can disable keys over incorrect information.
4. Optional: join the eBay Partner Network and set `EBAY_CAMPAIGN_ID` so "Buy on eBay" uses affiliate links.
5. Verify: `pnpm run doctor` → "eBay Browse API: ON, token issued".

Default limit is 5,000 calls/day for the whole app; listings are cached 6 hours per brand, and higher limits need eBay's Application Growth Check.

### Anthropic

1. [console.anthropic.com](https://console.anthropic.com) → API Keys → Create key.
2. Set a monthly spend limit in the console (Billing → Limits).
3. Put the key in `ANTHROPIC_API_KEY`. In-app caps also apply: `VISION_DAILY_BATCH_CAP` (default 60 batches/day) and `LLM_DAILY_GENERATION_CAP` (default 30 generations/day).

### Supabase secret key

Supabase dashboard → Project Settings → API Keys → **Secret keys** → create one, put it in `SUPABASE_SECRET_KEY`. Server-only: never prefix it with `NEXT_PUBLIC_`.

### Unsplash

1. [unsplash.com/developers](https://unsplash.com/developers) → New Application, accept the API guidelines.
2. Copy the **Access Key** into `UNSPLASH_ACCESS_KEY`.
3. New apps run in demo mode (50 requests/hour). Apply for production from the app page once screenshots with attribution exist.

### Pexels

[pexels.com/api](https://www.pexels.com/api/) → Your API Key → copy into `PEXELS_API_KEY`. Attribution to Pexels and the photographer is required (the pin sheet shows it).

### YouTube

Google Cloud Console → create a project → enable **YouTube Data API v3** → Credentials → API key → restrict it to that API → `YOUTUBE_API_KEY`. The app spends at most 80 searches a day (`subcult:yt:searches`), well under the 10,000-unit quota.

### Spotify

[developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → Create app → copy Client ID and Client Secret.

### PostHog

[posthog.com](https://posthog.com) → new project → Project settings → copy the **Project API key** (`phc_…`) into `NEXT_PUBLIC_POSTHOG_KEY` and the host (`https://us.i.posthog.com` or `https://eu.i.posthog.com`) into `NEXT_PUBLIC_POSTHOG_HOST`.

### Web push

Run `npx web-push generate-vapid-keys` once. Public key → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, private key → `VAPID_PRIVATE_KEY`. Generate a new pair for production; changing it later invalidates existing subscriptions.

### Admin and cron secrets

Generate each with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` (run it twice). `ADMIN_SECRET` is the `/admin` password (any username). Vercel sends `CRON_SECRET` to cron routes automatically.

## Google sign-in (OAuth consent screen)

1. Google Cloud Console → **APIs & Services → OAuth consent screen**. User type: External.
2. App name `subcult`, support email, and the app's links:
   - Home page: `https://<your domain>/about`
   - Privacy policy: `https://<your domain>/privacy`
   - Terms of service: `https://<your domain>/terms`
3. Authorized domain: your production domain (and `supabase.co`).
4. Scopes: only `openid`, `email`, `profile`.
5. **Credentials → Create OAuth client ID** → Web application. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
6. Supabase → Authentication → Providers → Google: paste the client ID and secret.
7. Supabase → Authentication → URL Configuration: Site URL = your production URL; add `https://<your domain>/auth/callback` to Redirect URLs.
8. Publish the consent screen (Testing mode only lets listed test users sign in).
