#!/usr/bin/env python3
"""
DICOM Anonymization Script for FGATIR Rater Study
==================================================

Strips Protected Health Information (PHI) from DICOM files in-place.
Preserves pixel data and geometric/imaging metadata needed for viewing.

Usage:
    python scripts/anonymize-dicoms.py [input_dir] [--dry-run]

Default input_dir: local-data/
"""

import argparse
import glob
import os
import sys

try:
    from pydicom import dcmread
    from pydicom.uid import generate_uid
except ImportError:
    print("ERROR: pydicom is required. Install with: pip install pydicom")
    sys.exit(1)


# DICOM tags containing PHI that must be removed/blanked
# Based on DICOM PS3.15 Annex E (Basic Application Level Confidentiality Profile)
PHI_TAGS_TO_BLANK = [
    # Patient-level
    "PatientName",
    "PatientID",
    "PatientBirthDate",
    "PatientBirthTime",
    "PatientSex",
    "PatientAge",
    "PatientWeight",
    "PatientSize",
    "PatientAddress",
    "PatientTelephoneNumbers",
    "OtherPatientIDs",
    "OtherPatientNames",
    "EthnicGroup",
    "PatientComments",
    # Study-level
    "StudyID",
    "AccessionNumber",
    "ReferringPhysicianName",
    "ReferringPhysicianAddress",
    "ReferringPhysicianTelephoneNumbers",
    "StudyDescription",  # may contain patient info in some institutions
    "RequestingPhysician",
    # Series-level
    "PerformingPhysicianName",
    "OperatorsName",
    "PhysiciansOfRecord",
    # Institution-level
    "InstitutionName",
    "InstitutionAddress",
    "InstitutionalDepartmentName",
    "StationName",
    # Other identifiers
    "DeviceSerialNumber",
    "ProtocolName",  # may reveal institution-specific naming
]

# Tags to remove entirely (rather than blank)
PHI_TAGS_TO_DELETE = [
    "RequestAttributesSequence",
    "PerformedProcedureStepDescription",
    "CommentsOnThePerformedProcedureStep",
    "AcquisitionComments",
    "ImageComments",
    "AdditionalPatientHistory",
]


def anonymize_file(filepath: str, dry_run: bool = False) -> dict:
    """Anonymize a single DICOM file in-place.

    Returns dict with counts of modified/deleted tags.
    """
    stats = {"blanked": 0, "deleted": 0, "skipped": False}

    try:
        ds = dcmread(filepath)
    except Exception as e:
        print(f"  WARNING: Cannot read {filepath}: {e}")
        stats["skipped"] = True
        return stats

    # Blank PHI tags
    for tag_name in PHI_TAGS_TO_BLANK:
        if hasattr(ds, tag_name):
            current_val = getattr(ds, tag_name)
            if current_val:  # Only count if non-empty
                if not dry_run:
                    setattr(ds, tag_name, "")
                stats["blanked"] += 1

    # Delete PHI tags entirely
    for tag_name in PHI_TAGS_TO_DELETE:
        if hasattr(ds, tag_name):
            if not dry_run:
                delattr(ds, tag_name)
            stats["deleted"] += 1

    # Save back
    if not dry_run and (stats["blanked"] > 0 or stats["deleted"] > 0):
        ds.save_as(filepath)

    return stats


def main():
    parser = argparse.ArgumentParser(description="Anonymize DICOM files for FGATIR study")
    parser.add_argument(
        "input_dir",
        nargs="?",
        default="local-data",
        help="Directory containing DICOM files (default: local-data/)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without modifying files",
    )
    args = parser.parse_args()

    input_dir = args.input_dir
    if not os.path.isdir(input_dir):
        print(f"ERROR: Directory not found: {input_dir}")
        sys.exit(1)

    # Find all .dcm files
    dcm_files = glob.glob(os.path.join(input_dir, "**", "*.dcm"), recursive=True)
    if not dcm_files:
        print(f"No .dcm files found in {input_dir}")
        sys.exit(0)

    print(f"{'[DRY RUN] ' if args.dry_run else ''}Anonymizing {len(dcm_files)} DICOM files in {input_dir}/")
    print("=" * 60)

    total_blanked = 0
    total_deleted = 0
    total_skipped = 0

    for i, filepath in enumerate(sorted(dcm_files), 1):
        stats = anonymize_file(filepath, dry_run=args.dry_run)
        if stats["skipped"]:
            total_skipped += 1
        else:
            total_blanked += stats["blanked"]
            total_deleted += stats["deleted"]

        # Progress indicator every 50 files
        if i % 50 == 0 or i == len(dcm_files):
            print(f"  Processed {i}/{len(dcm_files)} files...")

    print("=" * 60)
    print(f"Done! Summary:")
    print(f"  Files processed: {len(dcm_files) - total_skipped}")
    print(f"  Files skipped:   {total_skipped}")
    print(f"  Tags blanked:    {total_blanked}")
    print(f"  Tags deleted:    {total_deleted}")

    if args.dry_run:
        print("\n[DRY RUN] No files were modified. Run without --dry-run to apply changes.")


if __name__ == "__main__":
    main()
