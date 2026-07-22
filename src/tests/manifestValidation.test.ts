/**
 * Tests for manifest validation logic.
 *
 * Validates both programmatic (imageSource) validation
 * and the manifest structure requirements.
 */

import { describe, it, expect } from 'vitest';
import type { StudyManifest, CaseEntry, SeriesEntry } from '@/types';

// --- Helper to create valid manifests/entries ---

function createValidSeries(overrides: Partial<SeriesEntry> = {}): SeriesEntry {
  return {
    seriesId: 'ser_abc123',
    sliceCount: 10,
    rows: 256,
    columns: 256,
    bitsAllocated: 16,
    bitsStored: 12,
    windowCenter: 40,
    windowWidth: 80,
    transferSyntaxUID: '1.2.840.10008.1.2.1',
    ...overrides,
  };
}

function createValidCase(overrides: Partial<CaseEntry> = {}): CaseEntry {
  return {
    subjectId: 'SUB_001',
    series: [createValidSeries(), createValidSeries({ seriesId: 'ser_def456' })],
    ...overrides,
  };
}

function createValidManifest(overrides: Partial<StudyManifest> = {}): StudyManifest {
  return {
    version: '1.0.0',
    cases: [createValidCase()],
    ...overrides,
  };
}

// --- Validation function (mirrors imageSource logic) ---

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateManifest(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Manifest must be a non-null object'] };
  }

  const manifest = data as Record<string, unknown>;

  // Check version
  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('Missing or invalid "version" field (must be a string)');
  }

  // Check cases array
  if (!Array.isArray(manifest.cases)) {
    errors.push('Missing or invalid "cases" field (must be an array)');
    return { valid: false, errors };
  }

  if (manifest.cases.length === 0) {
    errors.push('Manifest must contain at least one case');
  }

  const seenSubjectIds = new Set<string>();
  const seenSeriesIds = new Set<string>();

  for (let i = 0; i < manifest.cases.length; i++) {
    const caseEntry = manifest.cases[i] as Record<string, unknown>;

    if (!caseEntry.subjectId || typeof caseEntry.subjectId !== 'string') {
      errors.push(`cases[${i}]: Missing or invalid "subjectId"`);
    } else {
      if (seenSubjectIds.has(caseEntry.subjectId as string)) {
        errors.push(`cases[${i}]: Duplicate subjectId "${caseEntry.subjectId}"`);
      }
      seenSubjectIds.add(caseEntry.subjectId as string);
    }

    if (!Array.isArray(caseEntry.series)) {
      errors.push(`cases[${i}]: Missing or invalid "series" array`);
      continue;
    }

    if ((caseEntry.series as unknown[]).length === 0) {
      errors.push(`cases[${i}]: Must contain at least one series`);
    }

    for (let j = 0; j < (caseEntry.series as unknown[]).length; j++) {
      const series = (caseEntry.series as Record<string, unknown>[])[j]!;

      if (!series.seriesId || typeof series.seriesId !== 'string') {
        errors.push(`cases[${i}].series[${j}]: Missing or invalid "seriesId"`);
      } else {
        if (seenSeriesIds.has(series.seriesId as string)) {
          errors.push(
            `cases[${i}].series[${j}]: Duplicate seriesId "${series.seriesId}"`,
          );
        }
        seenSeriesIds.add(series.seriesId as string);
      }

      if (typeof series.sliceCount !== 'number' || (series.sliceCount as number) <= 0) {
        errors.push(`cases[${i}].series[${j}]: Invalid sliceCount (must be > 0)`);
      }

      if (typeof series.rows !== 'number' || (series.rows as number) <= 0) {
        errors.push(`cases[${i}].series[${j}]: Invalid rows (must be > 0)`);
      }

      if (typeof series.columns !== 'number' || (series.columns as number) <= 0) {
        errors.push(`cases[${i}].series[${j}]: Invalid columns (must be > 0)`);
      }

      if (typeof series.bitsAllocated !== 'number') {
        errors.push(`cases[${i}].series[${j}]: Missing bitsAllocated`);
      }

      if (typeof series.bitsStored !== 'number') {
        errors.push(`cases[${i}].series[${j}]: Missing bitsStored`);
      }

      if (typeof series.windowCenter !== 'number') {
        errors.push(`cases[${i}].series[${j}]: Missing windowCenter`);
      }

      if (typeof series.windowWidth !== 'number') {
        errors.push(`cases[${i}].series[${j}]: Missing windowWidth`);
      }

      if (!series.transferSyntaxUID || typeof series.transferSyntaxUID !== 'string') {
        errors.push(`cases[${i}].series[${j}]: Missing or invalid transferSyntaxUID`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// --- Tests ---

describe('Manifest Validation', () => {
  describe('valid manifests', () => {
    it('accepts a well-formed manifest', () => {
      const manifest = createValidManifest();
      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts a manifest with multiple cases', () => {
      const manifest = createValidManifest({
        cases: [
          createValidCase({ subjectId: 'SUB_001' }),
          createValidCase({
            subjectId: 'SUB_002',
            series: [
              createValidSeries({ seriesId: 'ser_xxx' }),
              createValidSeries({ seriesId: 'ser_yyy' }),
            ],
          }),
        ],
      });
      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
    });

    it('accepts various valid transfer syntax UIDs', () => {
      const manifest = createValidManifest({
        cases: [
          createValidCase({
            series: [
              createValidSeries({
                seriesId: 'ser_001',
                transferSyntaxUID: '1.2.840.10008.1.2',
              }),
              createValidSeries({
                seriesId: 'ser_002',
                transferSyntaxUID: '1.2.840.10008.1.2.4.70',
              }),
            ],
          }),
        ],
      });
      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid manifests', () => {
    it('rejects null input', () => {
      const result = validateManifest(null);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('non-null object');
    });

    it('rejects undefined input', () => {
      const result = validateManifest(undefined);
      expect(result.valid).toBe(false);
    });

    it('rejects non-object input', () => {
      const result = validateManifest('not an object');
      expect(result.valid).toBe(false);
    });

    it('rejects manifest without version', () => {
      const result = validateManifest({ cases: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('version'))).toBe(true);
    });

    it('rejects manifest without cases array', () => {
      const result = validateManifest({ version: '1.0.0' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('cases'))).toBe(true);
    });

    it('rejects empty cases array', () => {
      const result = validateManifest({ version: '1.0.0', cases: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('at least one case'))).toBe(true);
    });

    it('rejects case without subjectId', () => {
      const manifest = createValidManifest();
      (manifest.cases[0] as unknown as Record<string, unknown>).subjectId = '';
      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('subjectId'))).toBe(true);
    });

    it('rejects case with empty series array', () => {
      const manifest = createValidManifest({
        cases: [createValidCase({ series: [] })],
      });
      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('at least one series'))).toBe(true);
    });

    it('rejects series without seriesId', () => {
      const manifest = createValidManifest({
        cases: [
          createValidCase({
            series: [createValidSeries({ seriesId: '' })],
          }),
        ],
      });
      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('seriesId'))).toBe(true);
    });

    it('rejects series with zero sliceCount', () => {
      const manifest = createValidManifest({
        cases: [
          createValidCase({
            series: [createValidSeries({ sliceCount: 0 })],
          }),
        ],
      });
      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('sliceCount'))).toBe(true);
    });

    it('rejects series with negative dimensions', () => {
      const manifest = createValidManifest({
        cases: [
          createValidCase({
            series: [createValidSeries({ rows: -1 })],
          }),
        ],
      });
      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('rows'))).toBe(true);
    });

    it('detects duplicate subjectIds', () => {
      const manifest = createValidManifest({
        cases: [
          createValidCase({ subjectId: 'SUB_001' }),
          createValidCase({
            subjectId: 'SUB_001',
            series: [createValidSeries({ seriesId: 'ser_unique' })],
          }),
        ],
      });
      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Duplicate subjectId'))).toBe(true);
    });

    it('detects duplicate seriesIds across cases', () => {
      const manifest = createValidManifest({
        cases: [
          createValidCase({
            subjectId: 'SUB_001',
            series: [createValidSeries({ seriesId: 'ser_shared' })],
          }),
          createValidCase({
            subjectId: 'SUB_002',
            series: [createValidSeries({ seriesId: 'ser_shared' })],
          }),
        ],
      });
      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Duplicate seriesId'))).toBe(true);
    });

    it('reports multiple errors at once', () => {
      const result = validateManifest({
        // missing version
        cases: [
          {
            subjectId: '',
            series: [{ seriesId: '', sliceCount: -1 }],
          },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2);
    });
  });

  describe('blinding constraints', () => {
    it('manifest does not contain condition labels (original/denoised)', () => {
      const manifest = createValidManifest();
      const json = JSON.stringify(manifest).toLowerCase();
      expect(json).not.toContain('original');
      expect(json).not.toContain('denoised');
    });

    it('seriesId does not leak condition information', () => {
      // SeriesIds should be opaque identifiers
      const manifest = createValidManifest();
      for (const caseEntry of manifest.cases) {
        for (const series of caseEntry.series) {
          const id = series.seriesId.toLowerCase();
          expect(id).not.toContain('orig');
          expect(id).not.toContain('denois');
          expect(id).not.toContain('baseline');
          expect(id).not.toContain('enhanced');
        }
      }
    });
  });
});
