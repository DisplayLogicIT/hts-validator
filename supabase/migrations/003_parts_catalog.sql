-- Parts catalog: tracks every HTS code that has been validated, with its current status.
-- Upsert key is (org_id, hts_code) — one row per unique code per org.

CREATE TABLE IF NOT EXISTS parts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            TEXT NOT NULL,
  part_number       TEXT NOT NULL DEFAULT '',
  hts_code          TEXT NOT NULL,
  validation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('valid', 'not_found', 'error', 'pending')),
  usitc_description TEXT,
  duty_rate         TEXT,
  last_validated_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, hts_code)
);

CREATE INDEX IF NOT EXISTS idx_parts_org_status ON parts(org_id, validation_status);

ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
