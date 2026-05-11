# HTS Validator

A web app that cross-references Pentagon part numbers against the official USITC Harmonized Tariff Schedule (HTS). Users drop spreadsheets, CSVs, or documents into the dashboard and an AI agent returns validated HTS classifications with confidence scores and source citations.

**Owner:** Keith
**Status:** Architecture approved, no code yet. Next step is PR 1 (skeleton repo).

---

## Stack at a glance

- **Framework:** Next.js 16 (App Router) on Vercel
- **Auth:** Clerk
- **Database + Storage:** Supabase (Postgres + Storage, RLS keyed on Clerk subject)
- **LLM:** Anthropic API (Claude Sonnet 4.6)
- **Interactive agent:** Vercel API routes / server actions with streaming
- **Batch agent:** Inngest (durable background jobs for large spreadsheets)
- **HTS source:** USITC HTS REST API (cached locally in `hts_cache`)
- **Repo + CI:** GitHub → Vercel (auto-deploy main + preview deploys per PR)

Full architecture lives in `HTS Validator.md` — read that first for data flow, schema, env vars, and the suggested PR sequence.

---

## Working conventions (locked in)

- **Never let the agent invent HTS codes.** Agent proposes a code from the part description; we always verify the proposed code exists and is active in USITC before returning it to the user.
- **Cache USITC responses.** First lookup populates `hts_cache`; subsequent lookups hit the cache. Protects against rate limits and upstream outages.
- **Refresh HTS data on a schedule.** USITC updates the schedule periodically — add a cron to refresh `hts_cache` (Vercel Cron or Inngest schedule).
- **Single source of truth for user identity = Clerk.** Supabase RLS reads Clerk JWT claims; don't create a parallel auth system.
- **Server-side keys never leave the server.** `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, `ANTHROPIC_API_KEY`, Inngest signing keys are server-only.

---

## File parsing scope (MVP)

- **In:** `.xlsx`, `.csv`
- **Deferred to v2:** `.pdf` (needs OCR + table extraction — significant extra work)

---

## Open questions (don't answer these without checking with Keith)

These were flagged in `HTS Validator.md` §8 and are still open:

- **Org model.** Solo accounts or Clerk Orgs / teams with shared job history? Affects schema.
- **Output format.** Validated XLSX with appended columns, separate PDF report, or both?
- **Low-confidence handling.** Auto-flag for human review queue, or just mark in the output?

**Resolved:** ITAR / CUI compliance is handled outside this app and is out of scope. Commercial Supabase + Vercel is approved.

---

## Where things live

- `HTS Validator.md` — full stack plan, data flow, schema, env vars, deploy order, PR sequence
- `CLAUDE.md` — this file; orientation for future sessions

---

## Suggested first PR (PR 1: Skeleton)

When ready to build:

1. `npx create-next-app@latest` (App Router, TypeScript, Tailwind)
2. Add Clerk (`@clerk/nextjs`) with sign-in/sign-up routes and a protected `/dashboard`
3. Add Supabase client (`@supabase/supabase-js`) — connection test only, no schema yet
4. Push to GitHub, connect to Vercel, confirm preview deploy works
5. Stop. Review. Then PR 2.
