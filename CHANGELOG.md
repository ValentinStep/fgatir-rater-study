# Changelog

All notable changes to the FGATIR Rater Study application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-07-27

### Added
- Auto-scale window/level from volume data (P2/P98 percentile-based VOI)
- Structure-specific rating questions for thalamic/brainstem evaluation:
  - 7 boolean "improved visualization" questions (Mamillo-thalamic tract, STN,
    Dentato-rubro-thalamic tract, Red nuclei, Medial lemniscus, MLF, Olives)
  - 3 Likert 1–5 questions (Thalamic nuclei delineation, Brainstem internal
    structure clarity, Overall diagnostic confidence for posterior fossa)
- BooleanQuestionRenderer with Yes/No toggle buttons (green/red styling)
- Study completion screen with report export capabilities:
  - Download Report as JSON (full structured data)
  - Download Report as CSV (analysis-ready, booleans as 1/0)
  - Email Report to TS / VS via mailto: link (auto-downloads JSON for attachment)
- VITE_EMAIL_TS and VITE_EMAIL_VS environment variables for report recipients

### Changed
- Replaced generic image quality Likert questions with domain-specific anatomical structure questions
- Completion screen now shows actionable export options instead of static thank-you message

### Fixed
- Images no longer appear too bright on load (was using hardcoded W/L of 21/54)

## [1.0.0] - 2025-07-22

### Added
- Cornerstone3D DICOM stack viewport with window/level and scroll controls
- DICOM file ingestion CLI with neutral series ID generation and PHI stripping
- Configurable Likert-scale rating form (5 quality questions + optional comments)
- Deterministic seeded randomization for blinded presentation ordering
- Anti-consecutive constraint preventing same-subject series appearing back-to-back
- Local persistence (localStorage) for ratings and session state during development
- Supabase integration design (migrations, Row-Level Security, private storage)
- Session resume after browser refresh with in-progress auto-save
- Progress tracking header with unsaved changes indicator
- Diagnostic panel with PHI-safe output (toggled via Ctrl+Shift+D)
- Unblinding export script for admin use only
- Manifest validation CLI script
- GitHub Actions CI pipeline (typecheck, lint, test, build)
- 80+ unit and component tests (Vitest + React Testing Library)
- Playwright E2E test suite for UI integration testing
- Comprehensive documentation (README, CONTRIBUTING, DEPLOYMENT)
