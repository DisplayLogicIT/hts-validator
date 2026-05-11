# Pentagon Validation Agent — Stack & Architecture Plan

**Status:** Draft v1 — for review before any code is written
**Owner:** Keith
**Last updated:** 2026-05-11

---

## 1. What we're building

A web app where authorized users drop spreadsheets, CSVs, or documents containing Pentagon part numbers, and an AI agent cross-references each part against the official USITC Harmonized Tariff Schedule (HTS). The output is a validated report showing the suggested HTS code(s) for each part, with confidence scores and source citations.

The MVP has two interaction modes:

- **Single-part chat box** — paste a part number or description, get a real-time classification.
- **Batch upload** — drag a spreadsheet/CSV/PDF into the dashboard, kick off a background job, watch progress, download the validated file.

---

## 2. Stack summary

| Layer | Choice | Why |
|---|---|---|
| Repo + CI | GitHub | Standard. Vercel auto-deploys from main + preview deploys per PR. |
| Hosting / app framework | Vercel + Next.js 16 (App Router) | One platform for frontend + API routes. Streaming responses work out of the box. |
| Auth | Clerk | Drop-in auth UI, org/team support, easy role-based access. Issues JWTs that Supabase can verify. |
| Database + Storage | Supabase (Postgres + Storage) | Postgres for jobs/results/audit, Storage for uploaded spreadsheets. Row-level security ties data to Clerk user IDs. |
| LLM | Anthropic API (Claude Sonnet 4.6) | Best balance of reasoning quality and cost for classification + extraction tasks. |
| Interactive agent | Vercel API routes (server actions, streaming) | Sub-60s lookups. User sees output as it generates. |
| Batch agent | Inngest | Durable background jobs for large files. Handles retries, progress, partial failures. Free tier covers MVP. |
| HTS data source | USITC HTS REST API | Authoritative tariff lookups. Free, no key required for public endpoints. |

**One thing I'd flag now:** the USITC API is public but rate-limited and occasionally flaky. We should cache lookups in Supabase so we don't hit it for every classification, and so the dataset stays queryable even if the upstream is down. More on this in §5.

---

## 3. Data flow

### Interactive lookup (test box)
1. User types a part number / description in the chat box.
2. Next.js server action calls the agent with the user's input.
3. Agent calls a `search_hts` tool that hits USITC's API (or our cache).
4. Agent returns a classification with the matching HTS code(s), chapter, duty rate, and reasoning.
5. UI streams the response token-by-token.

### Batch validation (drag-and-drop)
1. User drops `parts.xlsx` (or `.csv`, `.pdf`) onto the dashboard.
2. File uploads to **Supabase Storage** (bucket: `uploads`, path scoped by user/org).
3. Server action creates a row in `validation_jobs` (status: `queued`) and enqueues an Inngest job.
4. Inngest worker:
   - Parses the file (xlsx → `sheetjs`, csv → `papaparse`, pdf → text extraction).
   - For each row, calls the agent to classify the part.
   - Writes each result to `validation_results` as it completes (so the dashboard can show live progress).
   - On completion, marks the job `done` and writes a downloadable output file back to Storage.
5. UI polls (or subscribes via Supabase Realtime) to show progress, then offers a download.

---

## 4. Database schema (first cut)

```
-- Tied to Clerk user/org IDs (text, not Supabase auth UIDs)

validation_jobs
  id              uuid pk
  user_id         text         -- Clerk user id
  org_id          text         -- Clerk org id (nullable for solo users)
  source_file    text         -- Supabase Storage path
  output_file    text         -- Supabase Storage path (nullable until done)
  status          text         -- queued | running | done | failed
  row_count       int
  rows_done       int
  error           text         -- nullable
  created_at      timestamptz
  finished_at     timestamptz  -- nullable

validation_results
  id              uuid pk
  job_id          uuid fk -> validation_jobs.id
  row_index       int
  raw_input       jsonb        -- original row data
  part_number     text
  part_description text
  hts_code        text         -- e.g. "8471.30.0100"
  hts_chapter     text
  duty_rate       text
  confidence      numeric      -- 0.0 - 1.0
  reasoning       text         -- agent's explanation
  citations       jsonb        -- {usitc_url, ruling_ids, etc.}
  created_at      timestamptz

hts_cache
  hts_code        text pk
  description     text
  chapter         text
  duty_rate       text
  raw_payload     jsonb        -- full USITC response
  fetched_at      timestamptz
```

RLS policies: users can only read/write rows where `user_id` matches their Clerk subject, with an exception for org members where `org_id` matches.

---

## 5. HTS integration notes

USITC publishes an HTS REST endpoint (e.g. `https://hts.usitc.gov/api/search?query=...`). Three things to bake in from day one:

- **Cache everything.** First hit goes to `hts_cache`, then USITC. Massively reduces latency and protects us from upstream outages.
- **Quarterly refresh.** USITC updates the HTS schedule periodically. Add a cron (Vercel Cron or Inngest schedule) to refresh the cache against published changes.
- **Treat HTS codes as the source of truth, not the agent.** The agent's job is to *propose* a code based on the part description; the validation step looks up the proposed code in USITC and confirms it's valid + active. Never let the agent invent codes — always verify.

---

## 6. Environment variables (what you'll need to collect)

```
# Vercel
NEXT_PUBLIC_APP_URL=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=        # for user/org sync to Supabase

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-only, never expose

# Anthropic
ANTHROPIC_API_KEY=

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# USITC (no key required for public endpoints; placeholder if we need one later)
USITC_API_BASE=https://hts.usitc.gov/api
```

---

## 7. Deploy order (when we get there)

1. Create the GitHub repo (empty Next.js 15 app).
2. Create Supabase project → run schema migrations.
3. Create Clerk app → wire publishable + secret keys.
4. Wire Clerk → Supabase (JWT template so Supabase RLS can read Clerk claims).
5. Wire Anthropic key.
6. Deploy to Vercel from GitHub.
7. Install Inngest → deploy the Inngest endpoint on Vercel.
8. Smoke test: single lookup, then a 100-row batch.

---

## 8. Open questions before we build

These don't block the architecture, but they'll shape the first build:

- **File types in scope for MVP.** XLSX + CSV are easy. PDFs of part catalogs are much harder (OCR, table extraction). My instinct: ship XLSX/CSV first, add PDF in v2.
- **Org model.** Single user, or do you need teams/orgs with shared job history? Clerk supports both — picking now saves rework.
- **Output format.** Validated XLSX with new columns appended? Separate report PDF? Both?
- **Confidence threshold + human review.** Should low-confidence matches get flagged for manual review in a queue, or just marked in the output?

**Resolved (2026-05-11):** ITAR / CUI compliance is handled outside this app — out of scope here. Commercial Supabase + Vercel approved.

---

## 9. What I'd build first (suggested PR sequence)

1. **PR 1 — Skeleton.** Next.js app, Clerk sign-in, Supabase connected, "hello world" protected dashboard.
2. **PR 2 — Single lookup.** Chat box that classifies one part via Anthropic + USITC. Proves the agent loop end-to-end.
3. **PR 3 — Upload + parse.** Drag-and-drop → Supabase Storage → parse rows into a preview table. No agent yet.
4. **PR 4 — Background batch.** Wire Inngest, run the agent over uploaded rows, show progress, produce a downloadable output.
5. **PR 5 — HTS cache + refresh job.** Move USITC calls behind the cache. Add the scheduled refresh.

Each PR is reviewable on its own and the app is shippable after PR 2.
