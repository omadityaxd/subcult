# subcult architecture

Key decisions and the trade-offs behind them. The README covers setup; this file covers _why_.

## Aggregate by link, don't host

subcult curates and links out (Spotify, YouTube, news, shops, social search). It never stores
or re-serves third-party content. That keeps it within every platform's terms, avoids storage
and moderation cost, and means a dead API degrades one section instead of the product.

## Data sources (verified October 2026)

| Section   | Source                                           | Fallback when unavailable          |
| --------- | ------------------------------------------------ | ---------------------------------- |
| Sounds    | Spotify Web API, Client Credentials, `/search`   | Spotify search + artist deep links |
| Tea       | Google News RSS search (no key)                  | Section hidden                     |
| Watch     | YouTube Data API v3 `search` (recent first)      | YouTube search deep links          |
| Community | **Deep links only** to the niche's subreddits    | n/a (no API involved)              |
| Drip      | Generated store search links                     | n/a                                |
| Moodboard | Pinterest / Instagram / TikTok search deep links | n/a                                |

**Reddit: no fetcher.** Reddit closed self-service API access in November 2025, shut off
unauthenticated `.json` endpoints in May 2026, and stops accepting new public API requests on
31 October 2026. The Community tab is designed as deep-link cards (top of the week, search
within the subreddit) instead of fetched posts. Nothing to break, nothing to rate-limit.

**Spotify: search only.** February 2026 development-mode changes require the app owner to have
Premium, cap `/search` at `limit=10`, and remove artist top tracks, new releases and browse
categories (recommendations and related artists were already gone for new apps). The fetcher
uses Client Credentials plus `/search` exclusively, spreading the 10-result budget across the
profile's `spotifyQueries` and `artists`. Without keys, the Sounds tab renders search and
artist deep links from the same profile data.

**Shops.** Global stores only (Amazon, Depop, Etsy, ASOS, Grailed, Google Shopping). The Amazon
storefront is configurable with `AMAZON_DOMAIN` (default `amazon.com`), with an optional
`AMAZON_AFFILIATE_TAG`.

## Cache-first LLM

A niche profile is generated once, validated with Zod and stored forever, keyed by a normalized
slug. The 30 launch niches are hand-curated JSON in `/data/niches`, bundled with the app, so
they render even if the database is down and cost nothing. Claude is only called for
user-typed niches that don't exist yet.
