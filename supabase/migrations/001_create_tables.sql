-- =============================================================================
-- 001_create_tables.sql
-- FGATIR Rater Study - Core Tables
-- =============================================================================

-- Studies table
CREATE TABLE studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  randomization_seed TEXT NOT NULL,
  config_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true
);

-- Raters table
CREATE TABLE raters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES studies(id),
  auth_user_id UUID REFERENCES auth.users(id),
  display_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(study_id, display_code),
  UNIQUE(study_id, auth_user_id)
);

-- Cases (subjects) table
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES studies(id),
  neutral_subject_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(study_id, neutral_subject_code)
);

-- Image series table (NO condition column in rater-visible queries)
CREATE TABLE image_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id),
  blinded_series_code TEXT NOT NULL,
  storage_prefix TEXT NOT NULL,
  slice_count INTEGER NOT NULL,
  geometry_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(blinded_series_code)
);

-- Assignments table
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id UUID NOT NULL REFERENCES raters(id),
  series_id UUID NOT NULL REFERENCES image_series(id),
  presentation_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(rater_id, series_id)
);

-- Ratings table
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id),
  rater_id UUID NOT NULL REFERENCES raters(id),
  series_id UUID NOT NULL REFERENCES image_series(id),
  responses_json JSONB NOT NULL,
  comments TEXT,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds NUMERIC,
  viewer_state_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assignment_id)
);
