#!/usr/bin/env bash
# ============================================================================
# ADD CASES TO FGATIR RATER STUDY
# ============================================================================
#
# This script does everything: ingest → anonymize → deploy.
# Just set INPUT_PATH below and run it.
#
# REQUIRED INPUT STRUCTURE:
# ─────────────────────────
# Your input folder must contain paired directories per subject.
# The script detects original vs. denoised by the "_denoised" suffix:
#
#   /path/to/cases/
#   ├── PatientA/                  ← original DICOM slices
#   │   └── *.dcm (or nested subdirs with DICOMs)
#   ├── PatientA_denoised/         ← denoised DICOM slices (same subject)
#   │   └── *.dcm
#   ├── PatientB/
#   ├── PatientB_denoised/
#   └── ...
#
# NAMING RULES:
#   • Each subject has TWO folders: "Name" and "Name_denoised"
#   • The folder names can be anything (e.g. patient IDs, dates, random strings)
#   • The "_denoised" suffix is how the system pairs them
#   • DICOMs can be at the top level or nested inside subdirectories
#     (the ingestion script auto-finds them)
#
# WHAT HAPPENS:
#   1. Ingest: copies DICOMs to local-data/ with anonymized filenames,
#              generates manifest.json and .unblinding-key.json
#   2. Anonymize: strips ALL PHI from DICOM headers in-place
#   3. Deploy: copies to public/dicom-data/, commits, and pushes to GitHub
#              (GitHub Actions will auto-deploy to Pages)
#
# ============================================================================

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  Pass input path as argument, or edit this default                     ║
# ╚══════════════════════════════════════════════════════════════════════════╝
INPUT_PATH="${1:-/path/to/your/cases}"

# ============================================================================
# DO NOT EDIT BELOW THIS LINE
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  FGATIR Rater Study — Add Cases Pipeline"
echo "════════════════════════════════════════════════════════════"
echo ""

# Validate input path
if [ "$INPUT_PATH" = "/path/to/your/cases" ]; then
    echo -e "${RED}ERROR: Provide the input path as an argument!${NC}"
    echo ""
    echo "  Usage: scripts/add-cases.sh /path/to/your/cases"
    echo ""
    echo "  Example:"
    echo "    scripts/add-cases.sh /Volumes/research/fieree01lab/labspace/Valentin/FGATIR_denoising/movies/temp"
    exit 1
fi

if [ ! -d "$INPUT_PATH" ]; then
    echo -e "${RED}ERROR: Input path does not exist: $INPUT_PATH${NC}"
    exit 1
fi

# Show what was found
echo -e "${YELLOW}Input path:${NC} $INPUT_PATH"
echo ""
echo "Folders found:"
ls -1d "$INPUT_PATH"/*/ 2>/dev/null | while read -r d; do
    echo "  $(basename "$d")"
done
echo ""

# Count pairs
DENOISED_COUNT=$(find "$INPUT_PATH" -maxdepth 1 -type d -name "*_denoised" | wc -l | tr -d ' ')
echo -e "${YELLOW}Detected $DENOISED_COUNT subject pair(s)${NC} (folders with _denoised suffix)"
echo ""

if [ "$DENOISED_COUNT" -eq 0 ]; then
    echo -e "${RED}ERROR: No *_denoised folders found in $INPUT_PATH${NC}"
    echo ""
    echo "Expected structure:"
    echo "  $INPUT_PATH/"
    echo "  ├── SubjectA/"
    echo "  ├── SubjectA_denoised/"
    echo "  ├── SubjectB/"
    echo "  └── SubjectB_denoised/"
    exit 1
fi

# Confirm
read -p "Proceed with ingestion + anonymization + deploy? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# ── Step 1: Ingest ──────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}[1/4] Ingesting cases...${NC}"
echo "      Input: $INPUT_PATH → Output: local-data/"
echo ""

npx tsx scripts/ingest-cases.ts --input "$INPUT_PATH" --output ./local-data

echo ""
echo -e "${GREEN}[2/4] Anonymizing DICOM headers...${NC}"
echo ""

# ── Step 2: Anonymize ───────────────────────────────────────────────────────
python3 scripts/anonymize-dicoms.py local-data/

echo ""
echo -e "${GREEN}[3/4] Copying to public/dicom-data/ for deployment...${NC}"
echo ""

# ── Step 3: Copy to public ──────────────────────────────────────────────────
cp -r local-data/series_* public/dicom-data/
cp local-data/manifest.json public/dicom-data/manifest.json

# Count what we're adding
NEW_FILES=$(find public/dicom-data/ -name "*.dcm" | wc -l | tr -d ' ')
echo "  Total DICOM files in public/dicom-data/: $NEW_FILES"

echo ""
echo -e "${GREEN}[4/4] Committing and pushing to GitHub...${NC}"
echo ""

# ── Step 4: Git commit & push ───────────────────────────────────────────────
git add public/dicom-data/
git commit -m "data: add $DENOISED_COUNT new case(s) from $(basename "$INPUT_PATH")"
git push

echo ""
echo "════════════════════════════════════════════════════════════"
echo -e "  ${GREEN}✓ Done!${NC} $DENOISED_COUNT case(s) added and deployed."
echo "  GitHub Actions will deploy to Pages within ~1 minute."
echo "════════════════════════════════════════════════════════════"
echo ""
