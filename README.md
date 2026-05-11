# HTS Validator

Cross-reference Pentagon part numbers against the official USITC Harmonized Tariff Schedule.

This is **PR 1: Skeleton** — Next.js 15 + Clerk auth + Supabase connection test. No validation logic yet.

See `HTS Validator.md` for the full architecture and PR sequence, and `CLAUDE.md` for project conventions.

## What's in this PR

- Next.js 15 (App Router, TypeScript, Tailwind v4)
- Clerk auth with `/sign-in`, `/sign-up`, and a protected `/dashboard`
- Supabase JS client with a `pingSupabase()` health check
- `/api/health` endpoint that returns Supabase reachability
- Dashboard renders the current user and a Supabase status indicator

## Local setup

```bash
# 1. Install deps
npm install

# 2. Copy env template and fill in keys
cp .env.example .env.local
# then edit .env.local with your Clerk + Supabase keys

# 3. Run dev server
npm run dev
```

Open http://localhost:3000 — click "Sign in", create an account via Clerk, and you should land on `/dashboard` with both auth and Supabase showing `ok` / `reachable`.

### Env vars

You need these in `.env.local` (see `.env.example` for the full list):

| Var | Where to get it |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk dashboard → API Keys |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API (server-only) |

## Deploy to Vercel

```bash
git init
git add .
git commit -m "PR 1: skeleton (Next.js + Clerk + Supabase wiring)"
git remote add origin https://github.com/<you>/hts-validator.git
git push -u origin main
```

Then in Vercel: New Project → Import the GitHub repo → paste the same env vars from `.env.local` into Vercel's environment variables → Deploy.

## What's next (PR 2)

Single-part lookup: a text box on the dashboard where you paste a part number/description and the agent returns a suggested HTS code with confidence and citation.
