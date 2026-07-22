# Deployment Guide

This document describes the three deployment targets for the FGATIR Rater Study application.

## Overview

| Target | Description | Data Storage | Auth |
|--------|-------------|-------------|------|
| Local Development | Vite dev server on localhost | localStorage | None (hardcoded dev rater ID) |
| Static Frontend Preview | GitHub Pages / Netlify / Vercel | localStorage | None |
| Production Research | Supabase-backed deployment | PostgreSQL + private Storage | Supabase Auth |

---

## 1. Local Development

The simplest deployment — used during development and testing.

### Setup

```bash
# Install dependencies
npm install --legacy-peer-deps

# Ingest DICOM data (requires raw-data/ directory with source DICOMs)
npm run ingest-cases

# Start dev server
npm run dev
```

### How It Works

- Vite serves the app at `http://localhost:5173`
- DICOM files are served from `public/dicom-data/` via Vite's static file serving
- Ratings are stored in browser `localStorage`
- Uses `STUDY_CONFIG.devRaterId` as the rater identifier
- The dev server automatically sets COOP/COEP headers for SharedArrayBuffer

### Limitations

- Data is per-browser (not shared across devices)
- No authentication
- Clearing browser data loses all ratings
- Not suitable for multi-rater studies

---

## 2. Static Frontend Preview

Deploy the built frontend to a static hosting service for demonstration purposes.

### Build

```bash
npm run build
```

This produces a `dist/` directory with static assets.

### Deploy to GitHub Pages

```bash
# Build with base path (if deploying to a subpath)
# Update vite.config.ts: base: '/your-repo-name/'
npm run build

# Deploy dist/ to gh-pages branch or use GitHub Actions
```

### Deploy to Netlify / Vercel

1. Connect your repository
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Set Node.js version: `22.x`
5. Add install command: `npm ci --legacy-peer-deps`

### Required Headers

For SharedArrayBuffer support, configure your hosting to serve these headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**Netlify** (`netlify.toml`):
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"
```

**Vercel** (`vercel.json`):
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

### Configurable Base Paths

For subpath deployment (e.g., `https://username.github.io/fgatir-rater/`):

```ts
// vite.config.ts
export default defineConfig({
  base: '/fgatir-rater/', // Set to your deployment subpath
  // ...
});
```

### ⚠️ Critical Warnings

> **DO NOT serve real patient DICOM data from static hosting.**
>
> Static hosting has no access control. Anyone with the URL can access all files.

- Use **synthetic/phantom data only** for static previews
- Include a visible banner indicating "DEMO MODE — synthetic data only"
- No authentication is available in static deployments
- Ratings are stored in localStorage (not persistent across browsers/devices)

---

## 3. Production Research Deployment

For actual research studies with multiple raters and real DICOM data.

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Browser   │────▶│ Supabase Auth│     │ Supabase Storage │
│ (React App) │     └──────────────┘     │ (Private Bucket) │
│             │                           │   DICOM files    │
│             │────▶┌──────────────┐     └─────────────────┘
│             │     │  PostgreSQL  │
└─────────────┘     │  (ratings,   │
                    │   sessions)  │
                    └──────────────┘
```

### Setup

1. **Create Supabase project** at [supabase.com](https://supabase.com)

2. **Run migrations**:
   ```bash
   supabase db push
   ```

3. **Configure environment**:
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_USE_SUPABASE=true
   ```

4. **Upload DICOM data** to a private Supabase Storage bucket:
   ```bash
   # Use the Supabase CLI or dashboard to upload ingested DICOM files
   # to a private bucket (NOT public)
   ```

5. **Configure Row-Level Security (RLS)**:
   - Raters can only read/write their own ratings
   - DICOM files accessible only to authenticated users
   - Unblinding data accessible only to admin role

6. **Deploy frontend** to your hosting platform of choice (Vercel, Netlify, etc.)

### Security Requirements

| Requirement | Implementation |
|-------------|---------------|
| Authentication | Supabase Auth (email/password or magic link) |
| Data isolation | PostgreSQL RLS policies per rater |
| DICOM privacy | Private Storage bucket with signed URLs |
| Transport | HTTPS only (enforced by Supabase) |
| Blinding | No condition labels in any client-facing data |

### ⚠️ Critical Warnings

> **Static hosting alone CANNOT securely serve private DICOM files.**
>
> You MUST use Supabase private Storage with signed URLs or equivalent
> authenticated access for any real patient data.

> **Do NOT put real patient data in public buckets.**
>
> Supabase public buckets are accessible to anyone with the URL.
> Always use private buckets with RLS-gated access.

### Monitoring

- Monitor Supabase dashboard for authentication failures
- Set up alerts for unusual data access patterns
- Review storage access logs periodically
- Back up PostgreSQL data regularly

---

## Pre-Deployment Checklist

Before deploying to any environment, verify:

- [ ] `npm run check` passes (typecheck + lint + test + build)
- [ ] `.env` is correctly configured (not committed to git)
- [ ] DICOM data has been properly anonymized (no PHI)
- [ ] Manifest validates: `npm run validate-manifest`
- [ ] COOP/COEP headers are configured on the hosting platform
- [ ] (Production) RLS policies are active and tested
- [ ] (Production) Storage bucket is set to PRIVATE
- [ ] (Production) Supabase Auth is configured with appropriate providers
- [ ] (Production) SSL/HTTPS is enforced
- [ ] No `console.log` statements in production code
- [ ] Bundle size is reasonable (check `dist/` output)

---

## Bundle Size Reference

After `npm run build`, expected output structure:

```
dist/
├── index.html                              0.46 KB (gzip: 0.30 KB)
├── assets/
│   ├── index-[hash].js                 3,752.35 KB (gzip: 1,041.48 KB)
│   ├── index-[hash].css                    0.57 KB (gzip: 0.34 KB)
│   ├── computeWorker-[hash].js         2,874.24 KB (web worker)
│   ├── decodeImageFrameWorker-[hash].js  148.75 KB (web worker)
│   ├── openjphjs-[hash].wasm          2,094.91 KB (gzip: 635.51 KB)
│   ├── openjpegwasm_decode-[hash].wasm   255.48 KB (gzip: 84.82 KB)
│   ├── libjpegturbowasm-[hash].wasm      178.73 KB (gzip: 69.70 KB)
│   └── charlswasm_decode-[hash].wasm     145.70 KB (gzip: 48.82 KB)
└── ...
```

The main bundle is large due to Cornerstone3D and DICOM WASM codecs. This is expected for a medical image viewer application. Key notes:

- **Main JS bundle**: ~3.7 MB raw → ~1.04 MB gzipped (includes Cornerstone3D core + tools)
- **Web workers**: Loaded on-demand for DICOM decoding and compute tasks
- **WASM codecs**: Loaded only when required by the transfer syntax of loaded DICOMs
- **Total gzipped transfer**: ~1.04 MB for initial page load (workers/WASM loaded on demand)
