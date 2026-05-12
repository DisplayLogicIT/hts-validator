# Upload + Batch Classification + History — Design Spec
**Date:** 2026-05-12  
**Status:** Approved

## What We're Building

Three interconnected features in one PR:

1. **Upload page** — drag-and-drop XLSX/CSV, agent auto-detects columns, preview rows, start classification
2. **Inline progress + results** — progress bar fills as each row is classified; results table populates live; download button appears on completion
3. **History page** — every job ever run (batch uploads and single lookups) in one table with View/Download links

This replaces PR3 + PR4 as originally scoped. Inngest is deferred — files are small enough to process client-driven without a background job queue.

---

## Approved Design

### Upload Page (`app/dashboard/upload/page.tsx`)

**State 1 — Empty:** Large centered drop zone with dashed blue border, upload icon, "Drop XLSX or CSV here / or click to browse" label.

**State 2 — File dropped / parsed:** 
- File pill showing filename + "✓ N parts detected · Part No. in col A, Description in col B"
- Blue info banner: agent auto-detection summary (which columns it found and why)
- Preview table: first 10 rows, Part Number + Description columns
- "Start Classification" button (navy, full-width)

**State 3 — Classifying:**
- File pill stays
- Progress bar: "Classifying against USITC… 18 / 47" with estimated time remaining
- Live results table populates row by row: Part Number | HTS Code | Confidence | Status badge (Done/Queued/Error)

**State 4 — Complete:**
- Progress bar replaced by "✓ Classification complete — 47 / 47"
- Full results table visible
- "Download Results (.xlsx)" button — generates output file client-side
- "Upload another file" link resets to State 1

### History Page (`app/dashboard/history/page.tsx`)

Table of all jobs for the current user:

| Column | Notes |
|---|---|
| File / Query | Filename for batch; truncated query for single lookups |
| Type | "Batch" (blue pill) or "Single" (grey pill) |
| Rows | Row count |
| Avg Conf. | Average confidence score, color-coded |
| Date | "Today 2:14pm" or "May 10" |
| Actions | "View" link → job detail; "↓" download link (batch only) |

Single lookups from the Lookup page appear here automatically — no extra work.

### Sidebar Updates

- Upload: remove "Soon" badge and `cursor-not-allowed`, wire to `/dashboard/upload`
- History: remove `cursor-not-allowed`, wire to `/dashboard/history`
- Batch Jobs: stays disabled for now (future PR)

---

## Architecture

### Processing Model: Client-Driven Sequential

Files are small (typically 20–100 rows). The client drives the loop:

1. Browser parses file with `xlsx` / `papaparse`
2. Client calls `POST /api/jobs` → gets back a `job_id`
3. Client iterates rows, calling `POST /api/validate` with `{ query, job_id }` for each
4. Validate route: if `job_id` provided, insert result under that job instead of creating a new one
5. After each response, client updates progress state and results table
6. When all rows done, client calls `PATCH /api/jobs/[id]` with `{ status: 'complete', rows_done: N }`
7. Client generates download file from accumulated results (no Storage needed)

**Row error handling:** If `/api/validate` returns an error for a row, that row gets a red "Error" badge in the results table. Processing continues with the next row. The final job status is `complete` regardless of individual row failures (errors are visible per-row in the results).

**Tradeoff:** If user closes the tab mid-run, processing stops. Acceptable for small files in a business tool. Inngest can be added later for large-file support.

### Column Auto-Detection

Priority order for part number column:
1. Header contains "part", "nsn", "pn", "p/n", "part_no", "part_number" (case-insensitive)
2. First column as fallback

Priority order for description column:
1. Header contains "desc", "description", "name", "item" (case-insensitive)  
2. Second column as fallback

If only one column exists, treat it as part number. Detection result shown in info banner so user can see what the agent found.

---

## Files to Create / Modify

### New files
- `app/dashboard/upload/page.tsx` — thin server wrapper, exports `force-dynamic`
- `components/upload-form.tsx` — client component: all drop zone, parsing, classification loop, progress, results, download logic
- `app/dashboard/history/page.tsx` — server component: fetches jobs via admin client, renders table
- `app/api/jobs/route.ts` — `POST` (create batch job), `GET` (list jobs for current user)
- `app/api/jobs/[id]/route.ts` — `PATCH` (update job status/rows_done)
- `supabase/migrations/002_batch_jobs.sql` — add columns to `validation_jobs` and `validation_results`

### Modified files
- `app/api/validate/route.ts` — accept optional `job_id` in request body; if present, skip creating a new job and insert result under the provided job
- `app/dashboard/layout.tsx` — activate Upload and History nav links; remove "Soon" badge

### New npm packages
- `xlsx` — XLSX parsing (client-side) and output generation
- `papaparse` + `@types/papaparse` — CSV parsing

---

## Database Migration

```sql
-- Add batch-specific columns to validation_jobs
ALTER TABLE validation_jobs
  ADD COLUMN IF NOT EXISTS file_name   TEXT,
  ADD COLUMN IF NOT EXISTS row_count   INT,
  ADD COLUMN IF NOT EXISTS rows_done   INT NOT NULL DEFAULT 0;

-- Update status constraint to include 'processing'
ALTER TABLE validation_jobs
  DROP CONSTRAINT IF EXISTS validation_jobs_status_check;
ALTER TABLE validation_jobs
  ADD CONSTRAINT validation_jobs_status_check
    CHECK (status IN ('pending', 'processing', 'complete', 'error'));

-- Add row index to results for ordering
ALTER TABLE validation_results
  ADD COLUMN IF NOT EXISTS row_index INT;
```

---

## API Contract

### `POST /api/jobs`
**Body:** `{ type: 'batch', file_name: string, row_count: number }`  
**Returns:** `{ id: string }`  
**Auth:** Clerk — 401 if not signed in

### `PATCH /api/jobs/[id]`
**Body:** `{ status?: string, rows_done?: number }`  
**Returns:** `{ ok: true }`  
**Auth:** Clerk — 401 if not signed in; 403 if job's `org_id` doesn't match `orgId ?? userId`

### `GET /api/jobs`
**Query:** none  
**Returns:** `{ jobs: Job[] }` — ordered by `created_at DESC`  
**Auth:** Clerk — 401 if not signed in

### `POST /api/validate` (updated)
**Body:** `{ query: string, job_id?: string }`  
**Behavior change:** If `job_id` provided, inserts result under that job and does NOT create a new `validation_job` row  

---

## Out of Scope (this PR)
- Supabase Storage (file stored client-side only; reconstructed for download)
- Inngest / background processing
- Batch Jobs page (sidebar item stays disabled)
- PDF upload
- Row-level re-classification / editing results
- Sharing or exporting to other formats
