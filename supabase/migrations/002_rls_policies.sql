-- =============================================================================
-- 002_rls_policies.sql
-- FGATIR Rater Study - Row-Level Security Policies
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE raters ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Studies: read-only for authenticated raters
CREATE POLICY "Raters can view their study" ON studies
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM raters WHERE raters.study_id = studies.id AND raters.auth_user_id = auth.uid())
  );

-- Raters: can only see their own record
CREATE POLICY "Raters can view own record" ON raters
  FOR SELECT USING (auth_user_id = auth.uid());

-- Cases: viewable by raters in the same study
CREATE POLICY "Raters can view study cases" ON cases
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM raters WHERE raters.study_id = cases.study_id AND raters.auth_user_id = auth.uid())
  );

-- Image series: viewable by raters who have assignments for them
CREATE POLICY "Raters can view assigned series" ON image_series
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assignments
      JOIN raters ON raters.id = assignments.rater_id
      WHERE assignments.series_id = image_series.id
      AND raters.auth_user_id = auth.uid()
    )
  );

-- Assignments: raters see only their own
CREATE POLICY "Raters can view own assignments" ON assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM raters WHERE raters.id = assignments.rater_id AND raters.auth_user_id = auth.uid())
  );

CREATE POLICY "Raters can update own assignments" ON assignments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM raters WHERE raters.id = assignments.rater_id AND raters.auth_user_id = auth.uid())
  );

-- Ratings: raters can insert their own, view their own
CREATE POLICY "Raters can insert own ratings" ON ratings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM raters WHERE raters.id = ratings.rater_id AND raters.auth_user_id = auth.uid())
  );

CREATE POLICY "Raters can view own ratings" ON ratings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM raters WHERE raters.id = ratings.rater_id AND raters.auth_user_id = auth.uid())
  );

-- =============================================================================
-- SECURITY NOTES:
-- - Raters cannot read other raters' submissions.
-- - Raters cannot discover original-vs-denoised status (no condition column).
-- - Admin access uses service-role key (bypasses RLS).
-- - No DELETE policies — data is append-only for audit integrity.
-- =============================================================================
