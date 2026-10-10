---
description: Research emerging Gen-Z niches on the web and publish up to 3 as trending niches (no API key needed)
argument-hint: "[optional focus, e.g. 'music scenes' or 'fashion']"
---

Do the trend engine's job by hand, using your own web search instead of the Anthropic API.
Focus (optional): $ARGUMENTS

## 1. Know what already exists

Run `pnpm trends:refresh --dry-run`. It prints every existing niche (seeds and database) and
the latest free signals from Google News and YouTube. It makes no LLM calls and no writes. Also
list `data/niches/` and `data/trends/`.

## 2. Research

Use web search to find aesthetics, scenes, style tribes or music micro-genres that Gen Z started
talking about in the **last 30 days**. Prefer independent outlets (fashion and music press, culture
newsletters, YouTube explainers) over SEO listicles.

Keep a candidate only if:

- **at least 3 independent sources** discuss it, and you opened each one and confirmed it does;
- it's a culture people identify with, not a single product, celebrity, event or meme format;
- it doesn't duplicate or rename an existing niche ("gorp girlies" is gorpcore, "coastal cowgirl"
  is coastal cowboy).

Pick **at most 3**. Proposing nothing is fine when nothing qualifies.

## 3. Write one file per niche: `data/trends/<slug>.json`

Each file is a full NicheProfile (same shape and quality bar as `data/niches/*.json`) plus trend
fields. `slug` must equal the slugified `name` (lowercase, words joined by `-`).

```json
{
  "slug": "office-siren",
  "schemaVersion": 1,
  "name": "office siren",
  "emoji": "👓",
  "tagline": "...",
  "description": "...",
  "palette": ["#...", "#...", "#...", "#...", "#..."],
  "vibeWords": ["..."],
  "artists": [{ "name": "...", "why": "..." }],
  "spotifyQueries": ["..."],
  "subreddits": ["..."],
  "newsQueries": ["..."],
  "youtubeQueries": ["..."],
  "brands": [{ "name": "...", "priceTier": "$$", "why": "..." }],
  "shopKeywords": ["..."],
  "pinterestQueries": ["..."],
  "instagramHashtags": ["..."],
  "tiktokQueries": ["..."],
  "relatedNiches": ["..."],
  "trendScore": 70,
  "whyNow": "one line on why it's emerging now",
  "sources": [
    { "url": "https://...", "title": "..." },
    { "url": "https://...", "title": "..." },
    { "url": "https://...", "title": "..." }
  ]
}
```

Rules: real artists, brands and subreddits only (no invented names); the palette runs darkest to
lightest; the tagline is funny Gen-Z, never cringe; `sources` are the real URLs you read;
`trendScore` (0-100) reflects how many independent, recent sources cover it.

## 4. Validate

Run `pnpm vitest run src/lib/trends/trend-file.test.ts` and fix anything it reports.

## 5. Publish

Run `pnpm trends:upsert`. It refuses overlaps with existing niches, never touches evergreen
niches, sets the 🔥 trending lifecycle (published now, expires after `TREND_TTL_DAYS`), and is
safe to re-run.

## 6. Report

List what you published, what you rejected and why, and the sources behind each new niche.
