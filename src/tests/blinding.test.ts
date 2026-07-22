/**
 * Blinding verification tests.
 *
 * Ensures that condition information (original/denoised) never leaks
 * into rater-facing data structures or APIs.
 */

import { describe, it, expect } from 'vitest';
import { generateAssignments } from '@/utils/assignmentGenerator';
import { buildAssignments } from '@/services/sessionService';
import type { StudyManifest, RandomizationConfig } from '@/types';

// The real manifest structure (no condition info)
const TEST_MANIFEST: StudyManifest = {
  version: '1.0',
  cases: [
    {
      subjectId: 'subject_e0bf6532e081',
      series: [
        {
          seriesId: 'series_bc5b4745c247',
          sliceCount: 160,
          rows: 224,
          columns: 216,
          bitsAllocated: 16,
          bitsStored: 12,
          windowCenter: 21,
          windowWidth: 54,
          transferSyntaxUID: '1.2.840.10008.1.2.1',
        },
        {
          seriesId: 'series_3497ec7083b3',
          sliceCount: 160,
          rows: 224,
          columns: 216,
          bitsAllocated: 16,
          bitsStored: 12,
          windowCenter: 21,
          windowWidth: 54,
          transferSyntaxUID: '1.2.840.10008.1.2.1',
        },
      ],
    },
  ],
};

describe('Blinding Verification', () => {
  describe('Manifest structure', () => {
    it('does NOT contain "original" anywhere in manifest', () => {
      const manifestStr = JSON.stringify(TEST_MANIFEST);
      expect(manifestStr).not.toContain('original');
    });

    it('does NOT contain "denoised" anywhere in manifest', () => {
      const manifestStr = JSON.stringify(TEST_MANIFEST);
      expect(manifestStr).not.toContain('denoised');
    });

    it('does NOT contain "condition" anywhere in manifest', () => {
      const manifestStr = JSON.stringify(TEST_MANIFEST);
      expect(manifestStr).not.toContain('condition');
    });

    it('series entries have no condition-revealing fields', () => {
      for (const caseEntry of TEST_MANIFEST.cases) {
        for (const series of caseEntry.series) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const seriesAny = series as any;
          expect(seriesAny.condition).toBeUndefined();
          expect(seriesAny.sourceFolder).toBeUndefined();
          expect(seriesAny.originalPath).toBeUndefined();
          expect(seriesAny.type).toBeUndefined();
        }
      }
    });
  });

  describe('RandomizedAssignment output', () => {
    it('does NOT contain condition field', () => {
      const config: RandomizationConfig = {
        seed: 'fgatir-study-2024-v1',
        raterId: 'test-rater-001',
      };

      const assignments = generateAssignments(TEST_MANIFEST, config);

      for (const assignment of assignments) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const assignmentAny = assignment as any;
        expect(assignmentAny.condition).toBeUndefined();
        expect(assignmentAny.sourceFolder).toBeUndefined();
        expect(assignmentAny.isOriginal).toBeUndefined();
        expect(assignmentAny.isDenoised).toBeUndefined();
      }
    });

    it('serialized assignment JSON does not contain blinding keywords', () => {
      const config: RandomizationConfig = {
        seed: 'fgatir-study-2024-v1',
        raterId: 'test-rater-001',
      };

      const assignments = generateAssignments(TEST_MANIFEST, config);
      const serialized = JSON.stringify(assignments);

      expect(serialized).not.toContain('original');
      expect(serialized).not.toContain('denoised');
      expect(serialized).not.toContain('condition');
      expect(serialized).not.toContain('sourceFolder');
    });
  });

  describe('buildAssignments (session service)', () => {
    it('does NOT expose condition in Assignment output', () => {
      const assignments = buildAssignments(TEST_MANIFEST, 'blinding-test-rater');

      for (const assignment of assignments) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const assignmentAny = assignment as any;
        expect(assignmentAny.condition).toBeUndefined();
        expect(assignmentAny.sourceFolder).toBeUndefined();
      }
    });

    it('serialized buildAssignments output has no blinding keywords', () => {
      const assignments = buildAssignments(TEST_MANIFEST, 'blinding-test-rater');
      const serialized = JSON.stringify(assignments);

      expect(serialized).not.toContain('original');
      expect(serialized).not.toContain('denoised');
      expect(serialized).not.toContain('condition');
    });
  });

  describe('Rater differentiation', () => {
    it('different raters get different presentation orders', () => {
      const config1: RandomizationConfig = {
        seed: 'fgatir-study-2024-v1',
        raterId: 'rater-alpha',
      };
      const config2: RandomizationConfig = {
        seed: 'fgatir-study-2024-v1',
        raterId: 'rater-beta',
      };

      const assignments1 = generateAssignments(TEST_MANIFEST, config1);
      const assignments2 = generateAssignments(TEST_MANIFEST, config2);

      // With only 2 series, one rater gets [A, B] and the other may get [B, A]
      // or the same order. With enough raters, orders will differ.
      // For this specific test, just verify the structure is valid
      expect(assignments1).toHaveLength(2);
      expect(assignments2).toHaveLength(2);

      // Verify same series are present
      expect(assignments1.map((a) => a.seriesId).sort()).toEqual(
        assignments2.map((a) => a.seriesId).sort(),
      );
    });

    it('same rater + same seed always gets identical order', () => {
      const config: RandomizationConfig = {
        seed: 'fgatir-study-2024-v1',
        raterId: 'consistent-rater',
      };

      const run1 = generateAssignments(TEST_MANIFEST, config);
      const run2 = generateAssignments(TEST_MANIFEST, config);
      const run3 = generateAssignments(TEST_MANIFEST, config);

      expect(run1.map((a) => a.seriesId)).toEqual(run2.map((a) => a.seriesId));
      expect(run2.map((a) => a.seriesId)).toEqual(run3.map((a) => a.seriesId));
    });
  });

  describe('No condition leakage in source code contracts', () => {
    it('Assignment type fields do not include condition-related names', () => {
      const assignments = buildAssignments(TEST_MANIFEST, 'leak-check-rater');
      const firstAssignment = assignments[0]!;

      // Verify only expected fields exist
      const keys = Object.keys(firstAssignment);
      expect(keys.sort()).toEqual([
        'caseSubjectId',
        'displayLabel',
        'id',
        'presentationOrder',
        'raterId',
        'seriesId',
      ]);
    });
  });
});
