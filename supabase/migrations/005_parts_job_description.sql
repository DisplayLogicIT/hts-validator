-- Drop old unique constraint (switching from catalog upsert to per-job insert model)
ALTER TABLE parts DROP CONSTRAINT IF EXISTS parts_org_id_hts_code_key;

-- New columns
ALTER TABLE parts
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES validation_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lookup_result JSONB,
  ADD COLUMN IF NOT EXISTS lookup_status TEXT NOT NULL DEFAULT 'none'
    CHECK (lookup_status IN ('none', 'running', 'complete', 'error'));

-- Indexes for grouped queries
CREATE INDEX IF NOT EXISTS parts_job_id_idx ON parts(job_id);
CREATE INDEX IF NOT EXISTS parts_org_status_idx ON parts(org_id, validation_status);
