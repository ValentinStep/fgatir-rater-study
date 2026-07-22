# Changelog

All notable changes to the FGATIR Rater Study application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
