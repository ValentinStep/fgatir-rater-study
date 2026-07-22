-- =============================================================================
-- 003_unblinding_table.sql
-- FGATIR Rater Study - Unblinding Table (ADMIN ONLY)
-- =============================================================================
-- This table stores the original/denoised condition mapping.
-- It is NEVER exposed to raters via RLS — only accessible via service-role key.

CREATE TABLE unblinding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES image_series(id) UNIQUE,
  condition TEXT NOT NULL CHECK (condition IN ('original', 'denoised')),
  source_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: NO rater-facing policy — only accessible via service-role key
ALTER TABLE unblinding ENABLE ROW LEVEL SECURITY;

-- Explicitly no SELECT policy for authenticated users.
-- Admin access requires service-role key which bypasses RLS.
-- This ensures raters can NEVER discover the blinding condition,
-- maintaining study integrity.
