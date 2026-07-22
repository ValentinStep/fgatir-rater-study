# FGATIR Rater Study

A browser-based research image-review application for blinded quality assessment of brain MRI images (FGATIR sequence). Neuroradiologists evaluate randomized, blinded MRI series using a configurable Likert-scale rating form.

> **⚠️ NOT A MEDICAL DEVICE**: This software is a research tool for image quality assessment studies. It is **not** a certified diagnostic medical device and must not be used for clinical diagnosis or patient care decisions.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 19.x |
| Language | TypeScript | 5.9.3 |
| Build Tool | Vite | 8.x |
| DICOM Viewer | Cornerstone3D | 5.6.9 |
| Backend | Supabase (PostgreSQL + Auth + Storage) | 2.x SDK |
| Unit Tests | Vitest | 4.x |
| E2E Tests | Playwright | 1.61.x |
| Linting | ESLint + Prettier | — |

## Prerequisites

- **Node.js** 22.x (see `.nvmrc` — install via `nvm use` or set `PATH` manually)
- **npm** 10.x+
- **Supabase CLI** (optional, for backend features)
- **Playwright browsers** (optional, for E2E tests: `npx playwright install chromium`)

## Getting Started

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Copy environment template
cp .env.example .env
# Edit .env with your Supabase credentials (optional for local dev)

# 3. Ingest DICOM data (place source DICOMs in raw-data/ first)
npm run ingest-cases

# 4. Start development server
npm run dev
```

The application will open at `http://localhost:5173`.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint with zero-warning policy |
| `npm run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run check` | Run all checks (typecheck + lint + test + build) |
| `npm run inspect-dicom` | Inspect a DICOM file's metadata |
| `npm run ingest-cases` | Ingest, anonymize, and prepare DICOM cases |
| `npm run validate-manifest` | Validate the study manifest.json |
| `npm run export-unblinding` | Export unblinding key (admin only) |

## Project Structure

```
src/
├── app/                    # App entry component, initialization flow
├── components/
│   ├── DicomViewport/      # Cornerstone3D DICOM stack viewport
│   ├── ViewerToolbar/      # W/L, zoom, scroll controls
│   ├── RatingForm/         # Likert-scale rating interface
│   ├── ProgressHeader/     # Study progress indicator
│   └── DiagnosticPanel/    # Dev/debug panel (Ctrl+Shift+D)
├── config/                 # Study config, rating questions, feature flags
├── cornerstone/            # Cornerstone3D initialization & tools config
├── services/               # Rating, session, image source services
├── types/                  # Shared TypeScript type definitions
├── utils/                  # Randomization, assignment generator
└── tests/                  # Unit & component tests
scripts/                    # CLI scripts (ingestion, validation, unblinding)
supabase/                   # Database migrations and seed data
e2e/                        # Playwright E2E tests
public/                     # Static assets
docs/                       # Deployment and operational docs
```

## Display Consistency Rules

To ensure valid blinded comparisons, the application enforces strict display consistency:

1. **Single viewport** — one series displayed at a time (not side-by-side)
2. **Identical window settings** — W/L values from the manifest are applied consistently
3. **No annotations leaked** — SeriesDescription and condition labels are stripped
4. **Neutral labeling** — series are labeled "Image set 1", "Image set 2", etc.
5. **Consistent rendering** — same Cornerstone3D pipeline for all images
6. **No viewport manipulation history** — viewport resets between series

## Deployment Targets

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for detailed deployment instructions.

| Target | Storage | Auth | Use Case |
|--------|---------|------|----------|
| Local development | localStorage | None (dev rater ID) | Development & testing |
| Static preview | localStorage | None | Demo with synthetic data only |
| Production research | Supabase PostgreSQL | Supabase Auth | Real study with private DICOM data |

## Security & Privacy

- **DICOM files contain PHI** — never commit raw DICOM files to version control
- The ingestion script strips all identifying metadata before use
- `.gitignore` excludes all DICOM data paths (`local-data/`, `raw-data/`, `public/dicom-data/`)
- SeriesDescription is removed to maintain blinding
- No patient identifiers are stored in ratings
- Production deployment requires Supabase RLS (Row-Level Security) for data isolation

## Supported Browsers

This application requires **SharedArrayBuffer** support for WASM-based DICOM codec decoding:

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 110+ | ✅ Full support |
| Edge | 110+ | ✅ Full support (Chromium-based) |
| Firefox | 115+ | ✅ Full support |
| Safari | ❌ | Not supported (SharedArrayBuffer limitations) |

The dev server sets the required COOP/COEP headers automatically. For production, ensure your hosting provides:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Testing

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run E2E tests (requires Playwright browsers installed)
npm run test:e2e

# Full CI check
npm run check
```

The test suite includes:
- **Unit tests**: Rating config validation, service layer, randomization, blinding
- **Component tests**: Rating form interaction, App initialization
- **E2E tests**: Loading states, error handling, form rendering, keyboard shortcuts

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development guidelines.

## License

Private — Internal research use only. Please consult the project lead before selecting an open-source license.
