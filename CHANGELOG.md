# Changelog

All notable changes to HTS Validator are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/) — MAJOR.MINOR.PATCH

> **Rule:** every commit that changes behaviour must bump `package.json` version
> and add an entry here before pushing.

---

## [Unreleased]

---

## [1.4.1] — 2026-05-21
### Fixed
- TypeScript build error in `lib/db/jobs.ts` — `getValidationResult` joined  
  `validation_jobs` data, inferred by Supabase JS as `{ org_id: any }[]` (array),  
  could not be cast directly to `{ org_id: string } | null` (single object);  
  added `unknown` intermediate cast (`as unknown as`) to satisfy the compiler.  
  This was blocking every deploy since v1.3.0.

---

## [1.4.0] — 2026-05-21
### Changed
- **Scan now uses part description, not the code** — the initial upload already  
  tried the exact code and it failed; rescanning the same code would give the  
  same result. Instead, `POST /api/results/:id/scan` now reads  
  `raw_response.description` (the original CSV description column) and calls  
  `searchHts(description)` against `hts.usitc.gov`. If USITC returns a match  
  for that description, the result is definitively correct.
- **Description column** added to the Unvalidated table — shows the part  
  description from the original document so you can see what is being searched
- **Scan All progress bar** matches the upload page exactly — gradient fill,  
  `done / total · N validated` counter, Stop button, completion banner with  
  "Re-scan remaining" option
- `no_description` state — rows without a CSV description show  
  "No description to search" and disable the Scan button
- `not_found` state — rows where description search returns zero USITC  
  results are flagged "Not in USITC" (genuinely absent from the schedule)

---

## [1.3.0] — 2026-05-21
### Added
- **Unvalidated page — USITC scan** — each unvalidated row now has a "Scan"  
  button that re-checks the input code against `hts.usitc.gov` in real time
- **"Scan All" per batch** — runs up to 5 concurrent USITC lookups with a live  
  `done/total · N found` progress counter; a Stop button cancels mid-scan
- **Inline results** — found rows turn green and show the HTS code, USITC  
  description, and duty rate; still-not-found rows show "Still Not Found"
- When a code is found the `validation_results` row is updated in the database  
  (the part moves to Validated on next page load)
- `POST /api/results/:id/scan` — server-side USITC lookup + DB write

---

## [1.2.0] — 2026-05-21
### Added
- **History accordion** — each job row expands to show its full results table  
  (input, HTS code, description, duty rate, valid/not-found status); results  
  loaded lazily on first expand
- **Delete from History** — trash icon on each job archives it (soft-delete);  
  job disappears from History but is preserved in the archive
- **Archive section in Settings** — shows all archived jobs with created/archived  
  dates; each job has a **Restore** button (returns to History) and a  
  **permanent delete** button
- **Password-protected permanent delete** — permanent deletion from the archive  
  requires the `ARCHIVE_DELETE_PASSWORD` env var to be set in Vercel; a modal  
  prompts for the password before proceeding
- `GET /api/jobs?archived=true` — returns archived jobs for the current scope
- `GET /api/jobs/:id/results` — returns results for a single job (used by accordion)
- `PATCH /api/jobs/:id` — extended to accept `{ archive: true }` / `{ restore: true }`
- `DELETE /api/jobs/:id` — permanent delete; server-side password check

### Changed
- `listJobs()` now filters out archived jobs (`archived_at IS NULL`)
- History page converted from flat table to accordion layout

### DB
- `validation_jobs`: added `archived_at TIMESTAMPTZ DEFAULT NULL` column  
  (migration applied to project `yytjmkcxgardicwwlwtx` 2026-05-21)

---

## [1.1.1] — 2026-05-21
### Fixed
- TypeScript build error in `/api/debug` — `.catch()` does not exist on  
  `PostgrestBuilder`; replaced with `try/catch` so the build passes again.  
  This bug was silently blocking every deploy since the debug route was added.

---

## [1.1.0] — 2026-05-21
### Added
- **Settings page** — `/dashboard/settings` with Account (Clerk user info),  
  API & Integrations (placeholder), and Notifications (placeholder toggles) sections
- **Settings nav item** — gear icon link added to sidebar

### Fixed
- Validated / Unvalidated pages were capped at 1,000 rows (Supabase JS client  
  default); raised `listResultsGroupedByJob` limit to 10,000

---

## [1.0.2] — 2026-05-21
### Fixed
- Surface real Supabase error message instead of generic "Query failed"  
  (`PostgrestError` is not an `instanceof Error`; wrap with `new Error(error.message)`)
- Applied migration 002 to the correct Supabase project (`yytjmkcxgardicwwlwtx`)  
  and reloaded PostgREST schema cache — History page now loads correctly

### Changed
- `/api/debug` exposes `NEXT_PUBLIC_SUPABASE_URL` value (was boolean) to aid diagnosis

---

## [1.0.1] — 2026-05-20
### Fixed
- `throw error` on Supabase `PostgrestError` replaced with `throw new Error(error.message)`  
  across `listJobs`, `patchJob`, and `bulkInsertResults` so real errors reach the client

---

## [1.0.0] — 2026-05-20
### Added
- **Save to History button** — validation results no longer auto-save; user clicks  
  "Save to History" after reviewing results
- `POST /api/jobs/save` route — creates job + bulk-inserts all `validation_results` in one request
- `bulkInsertResults()` added to `jobRepository`
- **Version badge** in sidebar — shows `vX.X.X` from `package.json`, baked at build time  
  via `next.config.ts`; confirms deploy went through

### Changed
- `startValidation()` stripped of job creation and parts API calls — validation only
- `package.json` version field is now the source of truth for the displayed version

---

## [0.9.0] — 2026-05-19
### Fixed
- Strip UTF-8 BOM from Supabase env vars before passing to `createClient`  
  (pasted values with BOM caused `ByteString` 65279 errors on every request)
- Detect most-populated HTS column instead of first HTS-named column  
  (fixes files where HTS_CODE column exists but Schedule B column has the data)
- Parsing spinner added so UI is not silent while xlsx.js reads large files

---

## [0.8.0] — 2026-05-19
### Fixed
- Rename `proxy.ts` → `middleware.ts` — Next.js only loads middleware from that exact filename;  
  Clerk was silently skipped causing every API route to 500
- Wrap `auth()` in try/catch across all API routes; return `{ error }` JSON instead of blank 500
- Validated and Unvalidated pages pivot to read from `validation_results`  
  (parts table migrations 003/005 not yet applied)

### Added
- `/api/results` route for validated/unvalidated data
- `/api/debug` diagnostic endpoint

---

## [0.7.0] — 2026-05-19
### Changed
- Architectural deepening: extracted `lib/file-parser`, `lib/hts/usitc`, `lib/db/jobs`,  
  `lib/concurrency`, `lib/llm` from god-components
- In-memory read-through cache added to `lookupHtsCode` / `searchHts`
- History, Validated, Unvalidated pages converted to client-side fetch (CDN-served shells)

---

## [0.6.0] — 2026-05-13
### Added
- Precision instrument design — gradient sidebar, frosted topbars, dot-grid background,  
  active nav accent stripe
- Job-grouped validated/unvalidated views with batch accordion
- Claude Haiku "Research" button for unvalidated parts
- Upload localStorage cache (survives navigation); clear button; loading skeletons
- History counts: Valid / Not Found columns

---

## [0.5.0] — 2026-05-12
### Changed
- Replaced AI classification with direct USITC HTS code lookup  
  (valid = exact match in USITC schedule; not found = code absent)
- 20-worker parallel classification loop (was 8)

### Added
- Validated page, Unvalidated page, Parts catalog table
- Weekly revalidation cron

---

## [0.4.0] — 2026-05-11
### Added
- Upload page with drag-and-drop XLSX/CSV support
- Batch job processing with progress bar
- History page listing all jobs
- `validation_jobs` and `validation_results` DB tables (migration 001 + 002)

---

## [0.3.0] — 2026-05-08
### Added
- Dashboard sidebar layout (navy + white, IBM Plex font)
- Lookup form result card redesign

---

## [0.2.0] — 2026-05-07
### Fixed
- Clerk middleware wiring (proxy.ts / middleware.ts iterations)

---

## [0.1.0] — 2026-05-06
### Added
- Initial release: single HTS code lookup via Claude agent + USITC API
- Clerk auth, Supabase persistence, Vercel deployment
