-- Add batch-specific columns to validation_jobs
ALTER TABLE validation_jobs
  ADD COLUMN IF NOT EXISTS file_name  TEXT,
  ADD COLUMN IF NOT EXISTS row_count  INT,
  ADD COLUMN IF NOT EXISTS rows_done  INT NOT NULL DEFAULT 0;

-- Add row index to validation_results for ordering
ALTER TABLE validation_results
  ADD COLUMN IF NOT EXISTS row_index INT;
