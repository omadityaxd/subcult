# subcult

**find your niche.** subcult turns any subculture ("underground rap", "gorpcore", "dark academia")
into one feed: sounds, tea, community, videos, drip and a moodboard, all linking out to where
the content lives.

> 🚧 MVP in progress. The full README (architecture diagram, ranking formula, caching strategy)
> ships with the deploy phase.

## Run locally

```bash
pnpm install
cp .env.example .env.local   # every key is optional
pnpm dev                      # http://localhost:3000
```

| Script           | What it does                   |
| ---------------- | ------------------------------ |
| `pnpm dev`       | Next.js dev server (Turbopack) |
| `pnpm build`     | Production build               |
| `pnpm typecheck` | `tsc --noEmit` (strict)        |
| `pnpm lint`      | ESLint                         |
| `pnpm test`      | Vitest unit tests              |
| `pnpm format`    | Prettier (+ Tailwind sorting)  |

## Stack

Next.js 16 (App Router, Cache Components) · React 19.3 · TypeScript (strict) · Tailwind CSS v4 ·
shadcn/ui (Base UI) · Motion · vaul · Zod · Vitest
