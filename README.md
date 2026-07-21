# FGATIR Rater Study

A browser-based MRI rater-study application for blinded comparison of original and denoised brain MRI images (FGATIR sequence).

## Overview

This application enables neuroradiologists to perform blinded quality assessments of MRI images, comparing original acquisitions with CNN-denoised versions. The study uses a randomized, side-by-side presentation to eliminate bias.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **DICOM Viewing**: Cornerstone.js (core, tools, DICOM image loader)
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Linting**: ESLint + Prettier

## Prerequisites

- Node.js 22.x (see `.nvmrc`)
- npm 10.x+
- Access to Supabase project (for backend features)

## Getting Started

```bash
# Install dependencies
npm install --legacy-peer-deps

# Copy environment template
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |
| `npm run inspect-dicom` | Inspect DICOM file metadata |
| `npm run ingest-cases` | Ingest and anonymize DICOM cases |
| `npm run validate-manifest` | Validate study manifest |
| `npm run check` | Run all checks (typecheck + lint + test + build) |

## Project Structure

```
src/
├── app/                    # App entry, routing, layout
├── components/
│   ├── DicomViewport/      # Cornerstone.js DICOM viewer
│   ├── ViewerToolbar/      # Windowing, zoom, scroll controls
│   ├── RatingForm/         # Likert-scale rating interface
│   ├── ProgressHeader/     # Study progress indicator
│   └── DiagnosticPanel/    # Dev/debug information panel
├── cornerstone/            # Cornerstone.js init & configuration
├── config/                 # App configuration & feature flags
├── services/               # Supabase client, auth, data services
├── types/                  # Shared TypeScript type definitions
├── utils/                  # Utility functions
└── tests/                  # Test setup and test files
scripts/                    # CLI scripts (ingestion, validation)
supabase/                   # Database migrations and seed data
public/assets/              # Static assets (served DICOM data)
archive/legacy-prototype/   # Reference files from prior prototype
```

## Data Safety

⚠️ **IMPORTANT**: DICOM files contain Protected Health Information (PHI).
- Never commit raw DICOM files to version control
- The ingestion script strips all PHI before files are used
- The `.gitignore` is configured to exclude DICOM data paths
- SeriesDescription is removed to maintain blinding

## Architecture Decisions

- **Blinding**: Left/right assignment is randomized per case; SeriesDescription is stripped
- **Offline-first**: Ratings cached locally, synced to Supabase when online
- **Cornerstone.js**: Industry-standard DICOM viewer for web, supports WASM codecs
- **Config-driven**: Study parameters defined in configuration, not hard-coded

## License

Private - Internal research use only.
