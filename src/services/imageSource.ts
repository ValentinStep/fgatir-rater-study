/**
 * imageSource.ts
 *
 * Defines the ImageSource interface and implements LocalImageSource
 * for loading DICOM data from the local dev server.
 */

// --- Types ---

export interface SeriesEntry {
  seriesId: string;
  sliceCount: number;
  rows: number;
  columns: number;
  bitsAllocated: number;
  bitsStored: number;
  windowCenter: number;
  windowWidth: number;
  transferSyntaxUID: string;
}

export interface CaseEntry {
  subjectId: string;
  series: SeriesEntry[];
}

export interface StudyManifest {
  version: string;
  cases: CaseEntry[];
}

export interface ImageSource {
  getManifest(): Promise<StudyManifest>;
  getSeriesImageIds(seriesId: string): Promise<string[]>;
  getSubjectSeriesIds(subjectId: string): Promise<string[]>;
}

// --- LocalImageSource implementation ---

const DICOM_DATA_BASE_PATH = import.meta.env.VITE_DICOM_BASE_PATH || '/dicom-data';

export class LocalImageSource implements ImageSource {
  private manifest: StudyManifest | null = null;
  private manifestPromise: Promise<StudyManifest> | null = null;

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

  private async fetchManifest(): Promise<StudyManifest> {
    const url = `${DICOM_DATA_BASE_PATH}/manifest.json`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to load manifest from ${url}: ${response.status} ${response.statusText}`,
      );
    }

    const manifest = (await response.json()) as StudyManifest;

    // Basic validation
    if (!manifest.version || !Array.isArray(manifest.cases)) {
      throw new Error('Invalid manifest format: missing version or cases');
    }

    this.manifest = manifest;
    return manifest;
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

    // Build wadouri: image IDs
    const imageIds: string[] = [];
    for (let i = 1; i <= seriesEntry.sliceCount; i++) {
      const paddedIndex = String(i).padStart(3, '0');
      imageIds.push(
        `wadouri:${DICOM_DATA_BASE_PATH}/${seriesId}/slice_${paddedIndex}.dcm`,
      );
    }

    return imageIds;
  }

  /**
   * Get all series IDs for a given subject.
   */
  async getSubjectSeriesIds(subjectId: string): Promise<string[]> {
    const manifest = await this.getManifest();

    const caseEntry = manifest.cases.find((c) => c.subjectId === subjectId);
    if (!caseEntry) {
      throw new Error(`Subject not found in manifest: ${subjectId}`);
    }

    return caseEntry.series.map((s) => s.seriesId);
  }
}

// Singleton instance
let imageSourceInstance: LocalImageSource | null = null;

export function getImageSource(): LocalImageSource {
  if (!imageSourceInstance) {
    imageSourceInstance = new LocalImageSource();
  }
  return imageSourceInstance;
}
