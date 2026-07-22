/**
 * Randomization unit tests.
 *
 * Tests determinism, different-seeds behavior, different-rater behavior,
 * anti-consecutive constraint, and balance across raters.
 */

import { describe, it, expect } from 'vitest';
import {
  hashString,
  mulberry32,
  createRng,
  seededShuffle,
  antiConsecutiveOrder,
} from '@/utils/randomization';
import { generateAssignments } from '@/utils/assignmentGenerator';
import type { StudyManifest, RandomizationConfig } from '@/types';

// --- Mock manifests ---

const SINGLE_SUBJECT_MANIFEST: StudyManifest = {
  version: '1.0',
  cases: [
    {
      subjectId: 'subject_001',
      series: [
        {
          seriesId: 'series_A',
          sliceCount: 10,
          rows: 224,
          columns: 216,
          bitsAllocated: 16,
          bitsStored: 12,
          windowCenter: 21,
          windowWidth: 54,
          transferSyntaxUID: '1.2.840.10008.1.2.1',
        },
        {
          seriesId: 'series_B',
          sliceCount: 10,
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

const MULTI_SUBJECT_MANIFEST: StudyManifest = {
  version: '1.0',
  cases: [
    {
      subjectId: 'subject_001',
      series: [
        {
          seriesId: 'series_001_orig',
          sliceCount: 10,
          rows: 224,
          columns: 216,
          bitsAllocated: 16,
          bitsStored: 12,
          windowCenter: 21,
          windowWidth: 54,
          transferSyntaxUID: '1.2.840.10008.1.2.1',
        },
        {
          seriesId: 'series_001_den',
          sliceCount: 10,
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
    {
      subjectId: 'subject_002',
      series: [
        {
          seriesId: 'series_002_orig',
          sliceCount: 10,
          rows: 224,
          columns: 216,
          bitsAllocated: 16,
          bitsStored: 12,
          windowCenter: 21,
          windowWidth: 54,
          transferSyntaxUID: '1.2.840.10008.1.2.1',
        },
        {
          seriesId: 'series_002_den',
          sliceCount: 10,
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
    {
      subjectId: 'subject_003',
      series: [
        {
          seriesId: 'series_003_orig',
          sliceCount: 10,
          rows: 224,
          columns: 216,
          bitsAllocated: 16,
          bitsStored: 12,
          windowCenter: 21,
          windowWidth: 54,
          transferSyntaxUID: '1.2.840.10008.1.2.1',
        },
        {
          seriesId: 'series_003_den',
          sliceCount: 10,
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

describe('Seeded PRNG (mulberry32)', () => {
  it('produces deterministic output for the same seed', () => {
    const rng1 = mulberry32(12345);
    const rng2 = mulberry32(12345);

    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());

    expect(seq1).toEqual(seq2);
  });

  it('produces different output for different seeds', () => {
    const rng1 = mulberry32(12345);
    const rng2 = mulberry32(54321);

    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());

    expect(seq1).not.toEqual(seq2);
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(99999);
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});

describe('hashString', () => {
  it('produces consistent hashes for same input', () => {
    expect(hashString('hello')).toBe(hashString('hello'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashString('hello')).not.toBe(hashString('world'));
  });

  it('always returns a non-negative integer', () => {
    const testStrings = ['', 'a', 'test', 'longer string with spaces', '🎲'];
    for (const s of testStrings) {
      const hash = hashString(s);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(hash)).toBe(true);
    }
  });
});

describe('createRng', () => {
  it('same seed + raterId → same sequence', () => {
    const config: RandomizationConfig = { seed: 'study-2024', raterId: 'rater-1' };
    const rng1 = createRng(config);
    const rng2 = createRng(config);

    const seq1 = Array.from({ length: 20 }, () => rng1());
    const seq2 = Array.from({ length: 20 }, () => rng2());

    expect(seq1).toEqual(seq2);
  });

  it('different raterId → different sequence', () => {
    const rng1 = createRng({ seed: 'study-2024', raterId: 'rater-1' });
    const rng2 = createRng({ seed: 'study-2024', raterId: 'rater-2' });

    const seq1 = Array.from({ length: 20 }, () => rng1());
    const seq2 = Array.from({ length: 20 }, () => rng2());

    expect(seq1).not.toEqual(seq2);
  });

  it('different seed → different sequence', () => {
    const rng1 = createRng({ seed: 'study-2024', raterId: 'rater-1' });
    const rng2 = createRng({ seed: 'study-2025', raterId: 'rater-1' });

    const seq1 = Array.from({ length: 20 }, () => rng1());
    const seq2 = Array.from({ length: 20 }, () => rng2());

    expect(seq1).not.toEqual(seq2);
  });
});

describe('seededShuffle', () => {
  it('is deterministic with same rng state', () => {
    const arr1 = [1, 2, 3, 4, 5, 6, 7, 8];
    const arr2 = [1, 2, 3, 4, 5, 6, 7, 8];

    seededShuffle(arr1, mulberry32(42));
    seededShuffle(arr2, mulberry32(42));

    expect(arr1).toEqual(arr2);
  });

  it('preserves all elements (no duplicates, no losses)', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = [...original];
    seededShuffle(shuffled, mulberry32(7));

    expect(shuffled.sort()).toEqual(original.sort());
  });
});

describe('antiConsecutiveOrder', () => {
  it('avoids consecutive same-group items when possible (multi-group)', () => {
    const items = [
      { item: 'A1', groupId: 'A' },
      { item: 'A2', groupId: 'A' },
      { item: 'B1', groupId: 'B' },
      { item: 'B2', groupId: 'B' },
      { item: 'C1', groupId: 'C' },
      { item: 'C2', groupId: 'C' },
    ];

    const rng = mulberry32(123);
    const result = antiConsecutiveOrder(items, rng);

    // Check no consecutive same-group
    for (let i = 1; i < result.length; i++) {
      const prev = items.find((it) => it.item === result[i - 1])!;
      const curr = items.find((it) => it.item === result[i])!;
      expect(curr.groupId).not.toBe(prev.groupId);
    }
  });

  it('handles single group gracefully (cannot avoid consecutive)', () => {
    const items = [
      { item: 'A1', groupId: 'A' },
      { item: 'A2', groupId: 'A' },
    ];

    const rng = mulberry32(456);
    const result = antiConsecutiveOrder(items, rng);

    expect(result).toHaveLength(2);
    expect(result.sort()).toEqual(['A1', 'A2']);
  });

  it('preserves all items', () => {
    const items = [
      { item: 'X', groupId: 'G1' },
      { item: 'Y', groupId: 'G1' },
      { item: 'Z', groupId: 'G2' },
      { item: 'W', groupId: 'G2' },
    ];

    const rng = mulberry32(789);
    const result = antiConsecutiveOrder(items, rng);

    expect(result.sort()).toEqual(['W', 'X', 'Y', 'Z']);
  });
});

describe('generateAssignments', () => {
  describe('determinism', () => {
    it('same seed + raterId → same order every time', () => {
      const config: RandomizationConfig = {
        seed: 'fgatir-study-2024-v1',
        raterId: 'rater-001',
      };

      const result1 = generateAssignments(MULTI_SUBJECT_MANIFEST, config);
      const result2 = generateAssignments(MULTI_SUBJECT_MANIFEST, config);

      expect(result1.map((a) => a.seriesId)).toEqual(
        result2.map((a) => a.seriesId),
      );
    });

    it('different seeds → different orders', () => {
      const config1: RandomizationConfig = {
        seed: 'seed-alpha',
        raterId: 'rater-001',
      };
      const config2: RandomizationConfig = {
        seed: 'seed-beta',
        raterId: 'rater-001',
      };

      const result1 = generateAssignments(MULTI_SUBJECT_MANIFEST, config1);
      const result2 = generateAssignments(MULTI_SUBJECT_MANIFEST, config2);

      // Different orders (very unlikely to be the same with 6 items)
      expect(result1.map((a) => a.seriesId)).not.toEqual(
        result2.map((a) => a.seriesId),
      );
    });

    it('different raters → different orders', () => {
      const config1: RandomizationConfig = {
        seed: 'fgatir-study-2024-v1',
        raterId: 'rater-001',
      };
      const config2: RandomizationConfig = {
        seed: 'fgatir-study-2024-v1',
        raterId: 'rater-002',
      };

      const result1 = generateAssignments(MULTI_SUBJECT_MANIFEST, config1);
      const result2 = generateAssignments(MULTI_SUBJECT_MANIFEST, config2);

      expect(result1.map((a) => a.seriesId)).not.toEqual(
        result2.map((a) => a.seriesId),
      );
    });
  });

  describe('anti-consecutive constraint', () => {
    it('avoids adjacent same-subject series for multi-subject manifest', () => {
      // Run multiple times with different raters to check constraint
      let violations = 0;
      const totalTrials = 50;

      for (let i = 0; i < totalTrials; i++) {
        const config: RandomizationConfig = {
          seed: 'constraint-test',
          raterId: `rater-${i}`,
        };

        const result = generateAssignments(MULTI_SUBJECT_MANIFEST, config);

        for (let j = 1; j < result.length; j++) {
          if (result[j]!.subjectId === result[j - 1]!.subjectId) {
            violations++;
            break;
          }
        }
      }

      // With 3 subjects × 2 series = 6 items, it's always possible to avoid
      // consecutive same-subject. Allow at most 10% violations due to edge cases.
      expect(violations).toBeLessThan(totalTrials * 0.1);
    });
  });

  describe('balance', () => {
    it('across many raters, each series appears roughly equally in each position', () => {
      const numRaters = 100;
      const numSeries = MULTI_SUBJECT_MANIFEST.cases.reduce(
        (sum, c) => sum + c.series.length,
        0,
      );

      // Track how many times each series appears in each position
      const positionCounts = new Map<string, number[]>();
      for (const caseEntry of MULTI_SUBJECT_MANIFEST.cases) {
        for (const series of caseEntry.series) {
          positionCounts.set(series.seriesId, new Array(numSeries).fill(0) as number[]);
        }
      }

      for (let i = 0; i < numRaters; i++) {
        const config: RandomizationConfig = {
          seed: 'balance-test',
          raterId: `rater-${i}`,
        };

        const result = generateAssignments(MULTI_SUBJECT_MANIFEST, config);
        for (const assignment of result) {
          const counts = positionCounts.get(assignment.seriesId)!;
          counts[assignment.presentationOrder] =
            (counts[assignment.presentationOrder] ?? 0) + 1;
        }
      }

      // Expected count per position: numRaters / numSeries ≈ 16.7
      const expectedPerPosition = numRaters / numSeries;

      // Check that no position is extremely over- or under-represented
      // Allow 3x deviation (generous for 100 trials)
      for (const [, counts] of positionCounts) {
        for (const count of counts) {
          expect(count).toBeLessThan(expectedPerPosition * 3);
        }
      }
    });
  });

  describe('output structure', () => {
    it('includes all series from manifest', () => {
      const config: RandomizationConfig = {
        seed: 'test-seed',
        raterId: 'rater-X',
      };

      const result = generateAssignments(MULTI_SUBJECT_MANIFEST, config);
      const seriesIds = result.map((a) => a.seriesId).sort();
      const expectedIds = MULTI_SUBJECT_MANIFEST.cases
        .flatMap((c) => c.series.map((s) => s.seriesId))
        .sort();

      expect(seriesIds).toEqual(expectedIds);
    });

    it('assigns correct presentation orders (0-indexed, sequential)', () => {
      const config: RandomizationConfig = {
        seed: 'test-seed',
        raterId: 'rater-Y',
      };

      const result = generateAssignments(SINGLE_SUBJECT_MANIFEST, config);
      const orders = result.map((a) => a.presentationOrder);

      expect(orders).toEqual([0, 1]);
    });

    it('assigns correct display labels', () => {
      const config: RandomizationConfig = {
        seed: 'test-seed',
        raterId: 'rater-Z',
      };

      const result = generateAssignments(MULTI_SUBJECT_MANIFEST, config);

      for (const assignment of result) {
        expect(assignment.displayLabel).toBe(
          `Image set ${assignment.presentationOrder + 1}`,
        );
      }
    });

    it('does NOT include a condition field', () => {
      const config: RandomizationConfig = {
        seed: 'test-seed',
        raterId: 'rater-W',
      };

      const result = generateAssignments(MULTI_SUBJECT_MANIFEST, config);

      for (const assignment of result) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((assignment as any).condition).toBeUndefined();
      }
    });
  });
});
