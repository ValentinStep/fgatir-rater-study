-- =============================================================================
-- FGATIR Rater Study — Supabase Database Setup
-- =============================================================================
-- Run this SQL in the Supabase SQL Editor:
--   1. Go to supabase.com/dashboard → Your Project → SQL Editor
--   2. Click "New query"
--   3. Paste this entire file
--   4. Click "Run"
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- RATINGS TABLE
-- =============================================================================
-- Stores every rating submission from raters.
-- One row per case/series rated by a rater.

CREATE TABLE IF NOT EXISTS ratings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id   TEXT NOT NULL,
  rater_id        TEXT NOT NULL,
  series_id       TEXT NOT NULL,
  responses_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  viewer_state_json JSONB DEFAULT NULL,
  started_at      TIMESTAMPTZ DEFAULT NULL,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds NUMERIC(10,2) DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate submissions for same rater + assignment
  CONSTRAINT unique_rater_assignment UNIQUE (rater_id, assignment_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ratings_rater_id ON ratings (rater_id);
CREATE INDEX IF NOT EXISTS idx_ratings_series_id ON ratings (series_id);
CREATE INDEX IF NOT EXISTS idx_ratings_submitted_at ON ratings (submitted_at);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- The anon key can:
--   ✅ INSERT new ratings (anyone can submit)
--   ✅ SELECT their own ratings (by rater_id)
--   ❌ UPDATE existing ratings (immutable once submitted)
--   ❌ DELETE ratings (no one can tamper)

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert a rating
CREATE POLICY "Allow anonymous inserts"
  ON ratings
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Anyone can read all ratings (needed for study analysis)
-- In a production app you'd restrict to own rater_id, but for this
-- research study, all raters are trusted collaborators.
CREATE POLICY "Allow anonymous reads"
  ON ratings
  FOR SELECT
  TO anon
  USING (true);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================
-- Auto-update the updated_at timestamp on any row modification.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- After running, you should see the ratings table in Table Editor.
-- Test with:
--   SELECT * FROM ratings LIMIT 10;

SELECT 'Migration complete! ratings table created with RLS policies.' AS status;
