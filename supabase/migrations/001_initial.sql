-- Run this in the Supabase SQL editor for your project.
-- Dashboard → SQL Editor → New query → paste → Run

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS validation_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'single' CHECK (type IN ('single', 'batch')),
  status      TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('pending', 'processing', 'complete', 'error')),
  input_query TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS validation_results (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID NOT NULL REFERENCES validation_jobs(id) ON DELETE CASCADE,
  input_text       TEXT NOT NULL,
  hts_code         TEXT,
  hts_description  TEXT,
  confidence_score NUMERIC(4,3),
  source_url       TEXT,
  raw_response     JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validation_jobs_org_id ON validation_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_job_id ON validation_results(job_id);

-- RLS is enabled. The API uses the service-role key (server-only) which bypasses
-- RLS. User-scoped policies will be added in a later PR when Clerk JWTs are
-- wired into Supabase.
ALTER TABLE validation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_results ENABLE ROW LEVEL SECURITY;
