# FGATIR Rater — Next Session TODO

> **Last session:** July 23, 2026 | **Checkpoint:** `v0.8.0` (MPR + sync working)

---

## 1. Auto-Scale Window/Level (Default VOI)

**Problem:** Images are too bright on load; requires manual W/L correction every time.

**Goal:** Implement an auto-scale approach so the initial W/L is computed from the actual voxel data, not from DICOM header defaults.

**Approach:**
- On volume load, compute the intensity histogram (or min/max/percentile) of the voxel scalar data
- Use a percentile-based window: e.g., W = P99 − P1, L = (P99 + P1) / 2
- Alternatively: use the full dynamic range (max − min) with center at midpoint
- Apply this computed VOI as the initial `viewport.setProperties({ voiRange })` before first render
- Keep manual W/L tool functional (user can still override)

**Files to modify:**
- `src/components/DualDicomViewport/DualDicomViewport.tsx` — after `volume.load()`, compute VOI from `volume.getScalarData()`
- `src/components/DicomViewport/DicomViewport.tsx` — same for sequential mode

---

## 2. Update Rating Questions (Thalamic/Brainstem Structures)

**Problem:** Current Likert questions are too generic. Need structure-specific questions for neuroradiology assessment.

**Goal:** Replace or augment questions with specific anatomical structure visualization ratings.

**New questions to add (examples — refine with clinical team):**
- MLF (Medial Longitudinal Fasciculus) visualization: improved? (Yes / No / Not applicable)
- Thalamic nuclei delineation quality (Likert 1–5)
- Brainstem internal structure clarity (Likert 1–5)
- Red nucleus visibility (Likert 1–5)
- Substantia nigra boundary definition (Likert 1–5)
- Overall diagnostic confidence for posterior fossa (Likert 1–5)

**Files to modify:**
- `src/config/ratingQuestions.ts` — the question definitions array
- `src/types/rating.ts` — if new answer types needed (Yes/No vs Likert)
- `src/components/RatingForm/RatingForm.tsx` — if UI needs new input types (binary toggle vs scale)

---

## 3. Email-Based Report Submission (Replace Supabase for Now)

**Problem:** No database needed yet. Colleague (VS) wants to review output on first use. Simplest approach: email the completed ratings report.

**Goal:** On study completion, show a "Send Report" screen that emails the JSON/CSV results to TS or VS.

**Approach:**
- On the final "Study Complete" screen, show two buttons: **"Email to TS"** / **"Email to VS"**
- Emails will be added later (placeholder for now: `TS_EMAIL` and `VS_EMAIL` in `.env`)
- Generate a summary report (JSON or formatted text) of all ratings
- Use `mailto:` link with pre-filled subject + body (simplest, no backend needed)
- OR: use a lightweight email API (e.g., EmailJS, Resend) if `mailto:` body is too long
- Also offer a "Download Report" button (save as `.json` or `.csv` file locally)

**Files to modify:**
- `src/app/App.tsx` — add completion screen state
- New component: `src/components/CompletionScreen/CompletionScreen.tsx`
- `src/services/ratingService.ts` — add `exportRatings()` function
- `.env.example` — add `VITE_TS_EMAIL` and `VITE_VS_EMAIL` placeholders

---

## Quick Reference

```bash
# Resume development
cd /Users/stepav01/Documents/fgatir_rater_local
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
npm run dev

# Current state
git log --oneline -5
git tag -l          # v0.8.0
```
