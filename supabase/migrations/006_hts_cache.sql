-- HTS lookup cache — persistent read-through cache for USITC API responses.
-- Apply this in the Supabase SQL editor to enable DB-backed caching.
-- Until applied, lib/hts/usitc.ts falls back to in-memory caching (per function instance).

CREATE TABLE IF NOT EXISTS hts_cache (
  normalized_code  TEXT PRIMARY KEY,
  lookup_result    JSONB        NOT NULL,
  cached_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hts_cache_cached_at_idx ON hts_cache(cached_at);

-- No RLS needed — only accessed via service-role key server-side.
