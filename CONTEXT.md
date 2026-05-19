# HTS Validator — Domain Glossary

Terms used throughout the codebase. Architecture discussions and module names should use these.

## Core Domain

**HTS Code** — A Harmonized Tariff Schedule code (up to 10 digits, e.g. `8536.69.4030`) assigned by the US International Trade Commission (USITC) to classify imported goods. The fundamental unit of work in this system.

**USITC Schedule** — The official Harmonized Tariff Schedule published by the US International Trade Commission. The authoritative source. Never invent codes — only use codes returned by the USITC API.

**Validation** — The act of checking whether a given HTS code exists and is active in the USITC Schedule. A code is *valid* if USITC returns an exact match; *not found* if no match exists.

**Validation Job** — A recorded unit of work: either a single lookup or a batch upload. Persisted in `validation_jobs`. Each job belongs to a scope (org or user) and carries a status (`pending`, `processing`, `complete`, `error`).

**Validation Result** — The outcome of validating one HTS code, stored in `validation_results`. Contains the input code, the USITC-matched code (or null if not found), description, duty rate, confidence score, and source URL.

**Batch** — A validation job created from an uploaded spreadsheet (`.xlsx` or `.csv`). One job, many results. A Batch carries a file name and row count.

**Single Lookup** — A validation job created from one typed query on the Lookup page. One job, one result. Uses the Claude agent (not direct USITC lookup) to find the best matching code.

**Part** — A catalog entry representing a physical part number. Stored in the `parts` table (schema migrations 003+005). MVP: not yet fully in use — Validated and Unvalidated pages read from `validation_results` directly.

**Duty Rate** — The general tariff rate for an HTS code (e.g. `"Free"` or `"2.6%"`). Comes from USITC, stored alongside validation results.

**Confidence Score** — A 0.0–1.0 score on a Single Lookup result. `>=0.9` = exact match, `0.7–0.9` = strong match, `0.5–0.7` = possible, `<0.5` = poor. Used by the Claude agent; always `1.0` or `0.0` for direct USITC lookups.

## Infrastructure

**Scope** — The authorization boundary for data access: `orgId ?? userId` from Clerk. All queries filter by scope; all inserts tag records with it. Org model is an open question — scope is the stable abstraction.

**HTS Cache** — A read-through cache for USITC API responses. Currently in-memory (per function instance). Migration `006_hts_cache.sql` defines the DB table for persistent caching when applied.

**Validation Queue** — The concurrent worker pattern used during batch upload: N workers process rows in parallel via shared index, reporting progress. See `lib/concurrency.ts`.

**File Parser** — The module that accepts a browser File object (CSV or XLSX) and returns typed rows with column auto-detection. See `lib/file-parser/index.ts`.

**LLM Classifier** — The Anthropic Claude client used for HTS classification. Two operating modes: agent mode (claude-sonnet with search tool, used for Single Lookups) and fast mode (claude-haiku, used for fallback part lookup). See `lib/llm/index.ts`.
