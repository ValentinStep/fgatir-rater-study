-- =============================================================================
-- seed-dev.sql
-- FGATIR Rater Study - Development Seed Data
-- =============================================================================
-- Creates sample data matching the local dev manifest for testing.
-- Run with service-role credentials: psql or Supabase dashboard SQL editor.

-- 1. Create a development study
INSERT INTO studies (id, name, randomization_seed, config_json, active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'FGATIR Development Study',
  'dev-seed-2024',
  '{"description": "Local development study for testing"}',
  true
)
ON CONFLICT DO NOTHING;

-- 2. Create a development rater (no auth_user_id for local dev)
INSERT INTO raters (id, study_id, auth_user_id, display_code, active)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  NULL,
  'DEV-RATER-001',
  true
)
ON CONFLICT DO NOTHING;

-- 3. Create a test case matching the local manifest
INSERT INTO cases (id, study_id, neutral_subject_code)
VALUES (
  '00000000-0000-0000-0000-000000000100',
  '00000000-0000-0000-0000-000000000001',
  'SUBJ-001'
)
ON CONFLICT DO NOTHING;

-- 4. Create image series entries matching local dev data
-- Series A (blinded code)
INSERT INTO image_series (id, case_id, blinded_series_code, storage_prefix, slice_count, geometry_hash)
VALUES (
  '00000000-0000-0000-0000-000000001001',
  '00000000-0000-0000-0000-000000000100',
  'series_A',
  '00000000-0000-0000-0000-000000000001/series_A',
  176,
  NULL
)
ON CONFLICT DO NOTHING;

-- Series B (blinded code)
INSERT INTO image_series (id, case_id, blinded_series_code, storage_prefix, slice_count, geometry_hash)
VALUES (
  '00000000-0000-0000-0000-000000001002',
  '00000000-0000-0000-0000-000000000100',
  'series_B',
  '00000000-0000-0000-0000-000000000001/series_B',
  176,
  NULL
)
ON CONFLICT DO NOTHING;

-- 5. Create assignments for the dev rater
INSERT INTO assignments (id, rater_id, series_id, presentation_order, status)
VALUES (
  '00000000-0000-0000-0000-000000010001',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000001001',
  1,
  'pending'
)
ON CONFLICT DO NOTHING;

INSERT INTO assignments (id, rater_id, series_id, presentation_order, status)
VALUES (
  '00000000-0000-0000-0000-000000010002',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000001002',
  2,
  'pending'
)
ON CONFLICT DO NOTHING;

-- 6. Unblinding records (admin-only, for reference)
INSERT INTO unblinding (id, series_id, condition, source_description)
VALUES (
  '00000000-0000-0000-0000-000000100001',
  '00000000-0000-0000-0000-000000001001',
  'original',
  'Original FGATIR acquisition'
)
ON CONFLICT DO NOTHING;

INSERT INTO unblinding (id, series_id, condition, source_description)
VALUES (
  '00000000-0000-0000-0000-000000100002',
  '00000000-0000-0000-0000-000000001002',
  'denoised',
  'Denoised FGATIR reconstruction'
)
ON CONFLICT DO NOTHING;
