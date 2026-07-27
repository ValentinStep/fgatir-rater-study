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
├── app/                    # App entry component, orientation state management
├── components/
│   ├── DicomViewport/      # Sequential mode volume viewport with MPR
│   ├── DualDicomViewport/  # Side-by-side dual volume viewports (synchronized)
│   ├── ViewerToolbar/      # W/L, zoom, scroll, MPR plane selector controls
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

## Display Modes

The application supports two display modes, controlled by a single config flag in [`src/config/studyConfig.ts`](src/config/studyConfig.ts):

```typescript
// src/config/studyConfig.ts
export const STUDY_CONFIG: StudyConfig = {
  displayMode: 'sequential',  // or 'sideBySide'
  // ...
};
```

### Switching Between Modes

| Mode | Value | Use Case |
|------|-------|----------|
| Sequential (blinded) | `'sequential'` | Real study — one series at a time, fully blinded |
| Side-by-side | `'sideBySide'` | Demo/presentation — both series visible simultaneously |

**To switch:**
1. Open `src/config/studyConfig.ts`
2. Change the `displayMode` value to `'sequential'` or `'sideBySide'`
3. Save the file — Vite hot-reloads automatically (or restart `npm run dev`)
4. Clear localStorage (`localStorage.clear()` in browser console) to reset study progress

### Sequential Mode (`'sequential'`)
- One series displayed at a time in a single viewport
- Each series is a separate assignment; rater scores them independently
- Series order is randomized per subject (blinding preserved)
- Neutral labeling: "Image set 1", "Image set 2", etc.

### Side-by-Side Mode (`'sideBySide'`)
- Two viewports shown simultaneously for the same subject
- Left viewport: first series; Right viewport: second series
- Synchronized scrolling (slice position) and W/L adjustments
- Labels remain neutral ("Image Set A" / "Image Set B")
- One rating form per subject (rates the pair together)

## Multi-Planar Reconstruction (MPR)

Both display modes support MPR — the ability to view the 3D volume in any of the three standard orthogonal planes:

| Plane | Description | Keyboard Shortcut |
|-------|-------------|-------------------|
| **Axial** | Standard transverse cross-section (default) | — |
| **Sagittal** | Left-right slice through the midline | — |
| **Coronal** | Front-back slice through the volume | — |

### How It Works

The toolbar displays three plane selector buttons (**Ax**, **Sag**, **Cor**) with an active-state highlight. Clicking a plane button re-orients all active viewports simultaneously.

**Technical implementation:**
- DICOM images are loaded into Cornerstone3D **Volume Viewports** (`ViewportType.ORTHOGRAPHIC`) using [`volumeLoader.createAndCacheVolumeFromImages()`](src/components/DualDicomViewport/DualDicomViewport.tsx)
- Plane switching calls `viewport.setOrientation(OrientationAxis)` which recalculates camera vectors for the selected plane
- In side-by-side mode, both viewports share the same world coordinate space (same patient), enabling full camera synchronization via `CAMERA_MODIFIED` events
- Scroll, zoom, and pan are all synchronized — interacting with either viewport mirrors the action on the other
- Window/Level (VOI) adjustments are synchronized via `VOI_MODIFIED` events

### Synchronization Architecture

The dual viewport synchronization uses a manual event-based approach (not Cornerstone's built-in `SynchronizerManager`):

```
┌─────────────────┐    CAMERA_MODIFIED     ┌─────────────────┐
│  Left Viewport  │ ─────────────────────► │  Right Viewport │
│  (Volume A)     │ ◄───────────────────── │  (Volume B)     │
└─────────────────┘    CAMERA_MODIFIED     └─────────────────┘
        │                                          │
        │           VOI_MODIFIED                   │
        └──────────────────────────────────────────┘
```

- **`CAMERA_MODIFIED`** — fires on `viewport.element` whenever `setCamera()` is called (covers scroll, zoom, pan)
- **`VOI_MODIFIED`** — fires when window/level changes
- **Guard refs** (`isSyncingCameraRef`, `isSyncingVoiRef`) prevent infinite event loops
- **`requestAnimationFrame`** releases guards after the render cycle completes

## Display Consistency Rules

Regardless of display mode, the application enforces strict display consistency:

1. **Identical window settings** — W/L values from the manifest are applied consistently
2. **No annotations leaked** — SeriesDescription and condition labels are stripped
3. **Neutral labeling** — series are never identified as "original" or "denoised"
4. **Consistent rendering** — same Cornerstone3D pipeline for all images
5. **No viewport manipulation history** — viewport resets between assignments

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
