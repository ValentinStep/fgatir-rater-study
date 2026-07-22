/**
 * Assignment Generator
 *
 * Takes a study manifest and randomization config, produces a
 * randomized list of assignments for a specific rater.
 *
 * CRITICAL: This module NEVER includes condition (original/denoised)
 * in its output. The assignment is blinded by design.
 */

import type {
  StudyManifest,
  RandomizationConfig,
  RandomizedAssignment,
} from '@/types';
import { createRng, seededShuffle, antiConsecutiveOrder } from './randomization';

/**
 * Internal representation of a series item before ordering.
 */
interface SeriesItem {
  seriesId: string;
  subjectId: string;
}

/**
 * Generate randomized, blinded assignments for a rater.
 *
 * Algorithm:
 * 1. Collect all series from all cases in the manifest
 * 2. Shuffle the series within each subject group (intra-subject randomization)
 * 3. Apply anti-consecutive ordering across subjects
 * 4. Assign presentation order and neutral display labels
 *
 * @param manifest - The study manifest (no condition info)
 * @param config - Randomization config with seed and raterId
 * @returns Array of RandomizedAssignment (blinded, no condition exposed)
 */
export function generateAssignments(
  manifest: StudyManifest,
  config: RandomizationConfig,
): RandomizedAssignment[] {
  const rng = createRng(config);

  // 1. Collect all series items
  const allSeries: SeriesItem[] = [];
  for (const caseEntry of manifest.cases) {
    for (const series of caseEntry.series) {
      allSeries.push({
        seriesId: series.seriesId,
        subjectId: caseEntry.subjectId,
      });
    }
  }

  // 2. Shuffle within each subject group first
  const bySubject = new Map<string, SeriesItem[]>();
  for (const item of allSeries) {
    const existing = bySubject.get(item.subjectId);
    if (existing) {
      existing.push(item);
    } else {
      bySubject.set(item.subjectId, [item]);
    }
  }

  // Shuffle each subject's series independently
  for (const [, seriesGroup] of bySubject) {
    seededShuffle(seriesGroup, rng);
  }

  // 3. Apply anti-consecutive ordering
  // Flatten back with group info for the interleaving algorithm
  const groupedItems = Array.from(bySubject.entries()).flatMap(
    ([subjectId, items]) =>
      items.map((item) => ({ item, groupId: subjectId })),
  );

  // Shuffle the grouped items first to avoid input-order bias
  seededShuffle(groupedItems, rng);

  const ordered = antiConsecutiveOrder(groupedItems, rng);

  // 4. Build the final assignments with neutral labels
  const assignments: RandomizedAssignment[] = ordered.map((item, index) => ({
    id: `${config.raterId}_${item.seriesId}_${index}`,
    raterId: config.raterId,
    seriesId: item.seriesId,
    subjectId: item.subjectId,
    presentationOrder: index,
    displayLabel: `Image set ${index + 1}`,
  }));

  return assignments;
}
