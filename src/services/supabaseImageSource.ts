/**
 * Supabase Image Source
 *
 * Implements the ImageSource interface for loading DICOM images
 * from Supabase Storage using signed URLs.
 *
 * NOTE: This is a stub implementation. It requires a configured Supabase
 * instance with the `dicom-images` storage bucket and populated metadata tables.
 * For local development, use LocalImageSource instead.
 */

import type { ImageSource, StudyManifest, CaseEntry, SeriesEntry } from './imageSource';
import { getSupabaseClient } from './supabaseClient';

/** Default signed URL expiration in seconds (1 hour) */
const SIGNED_URL_EXPIRY_SECONDS = 3600;

/** Storage bucket name for DICOM images */
const STORAGE_BUCKET = 'dicom-images';

/** Row shape returned from the cases table query */
interface CaseRow {
  id: string;
  neutral_subject_code: string;
}

/** Row shape returned from the image_series table query */
interface SeriesRow {
  id: string;
  case_id: string;
  blinded_series_code: string;
  slice_count: number;
  geometry_hash: string | null;
}

export class SupabaseImageSource implements ImageSource {
  private manifest: StudyManifest | null = null;
  private manifestPromise: Promise<StudyManifest> | null = null;
  private studyId: string;

  constructor(studyId: string) {
    this.studyId = studyId;
  }

  async getManifest(): Promise<StudyManifest> {
    if (this.manifest) {
      return this.manifest;
    }

    if (this.manifestPromise) {
      return this.manifestPromise;
    }

    this.manifestPromise = this.fetchManifest();
    return this.manifestPromise;
  }

  async getSeriesImageIds(seriesId: string): Promise<string[]> {
    const manifest = await this.getManifest();

    // Find the series in the manifest
    let seriesEntry: SeriesEntry | undefined;
    for (const caseEntry of manifest.cases) {
      const found = caseEntry.series.find((s) => s.seriesId === seriesId);
      if (found) {
        seriesEntry = found;
        break;
      }
    }

    if (!seriesEntry) {
      throw new Error(`Series not found in manifest: ${seriesId}`);
    }

    // Generate signed URLs for each slice
    const signedUrls = await this.getSignedUrls(seriesId, seriesEntry.sliceCount);

    // Return as wadouri: image IDs
    return signedUrls.map((url) => `wadouri:${url}`);
  }

  // --- Private Methods ---

  private async fetchManifest(): Promise<StudyManifest> {
    const supabase = getSupabaseClient();

    // Fetch cases for this study
    const { data: casesRaw, error: casesError } = await supabase
      .from('cases')
      .select('id, neutral_subject_code')
      .eq('study_id', this.studyId);

    if (casesError) {
      throw new Error(`Failed to fetch cases: ${casesError.message}`);
    }

    const cases = (casesRaw ?? []) as unknown as CaseRow[];

    if (cases.length === 0) {
      throw new Error(`No cases found for study: ${this.studyId}`);
    }

    // Fetch series for all cases
    const caseIds = cases.map((c) => c.id);
    const { data: seriesRaw, error: seriesError } = await supabase
      .from('image_series')
      .select('id, case_id, blinded_series_code, slice_count, geometry_hash')
      .in('case_id', caseIds);

    if (seriesError) {
      throw new Error(`Failed to fetch series: ${seriesError.message}`);
    }

    const seriesData = (seriesRaw ?? []) as unknown as SeriesRow[];

    // Build manifest structure
    const caseEntries: CaseEntry[] = cases.map((c) => {
      const caseSeries = seriesData
        .filter((s) => s.case_id === c.id)
        .map(
          (s): SeriesEntry => ({
            seriesId: s.blinded_series_code,
            sliceCount: s.slice_count,
            // These fields are populated from DICOM metadata in production;
            // using defaults for the manifest structure
            rows: 0,
            columns: 0,
            bitsAllocated: 16,
            bitsStored: 16,
            windowCenter: 0,
            windowWidth: 0,
            transferSyntaxUID: '1.2.840.10008.1.2.1',
          }),
        );

      return {
        subjectId: c.neutral_subject_code,
        series: caseSeries,
      };
    });

    this.manifest = {
      version: '1.0',
      cases: caseEntries,
    };

    return this.manifest;
  }

  /**
   * Generate signed URLs for all slices in a series.
   * Handles retry on expired URLs.
   */
  private async getSignedUrls(
    seriesId: string,
    sliceCount: number,
  ): Promise<string[]> {
    const supabase = getSupabaseClient();

    const paths: string[] = [];
    for (let i = 1; i <= sliceCount; i++) {
      const paddedIndex = String(i).padStart(3, '0');
      paths.push(`${this.studyId}/${seriesId}/slice_${paddedIndex}.dcm`);
    }

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_EXPIRY_SECONDS);

    if (error) {
      throw new Error(`Failed to generate signed URLs: ${error.message}`);
    }

    if (!data || data.length !== sliceCount) {
      throw new Error(
        `Expected ${sliceCount} signed URLs, got ${data?.length ?? 0}`,
      );
    }

    // Check for individual errors and collect URLs
    const urls: string[] = [];
    for (const item of data) {
      if (item.error) {
        throw new Error(`Signed URL error for path: ${item.error}`);
      }
      if (!item.signedUrl) {
        throw new Error('Missing signedUrl in response');
      }
      urls.push(item.signedUrl);
    }

    return urls;
  }
}
