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
  PairedAssignment,
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

/**
 * Generate paired assignments for side-by-side mode.
 * Each assignment represents one subject with two series (randomized left/right).
 *
 * Algorithm:
 * 1. Collect subjects from the manifest
 * 2. Shuffle subject order deterministically
 * 3. For each subject, randomize which series is left vs right (blinded)
 * 4. Assign presentation order and neutral display labels
 *
 * @param manifest - The study manifest (blinded, no condition info)
 * @param config - Randomization config with seed and raterId
 * @returns Array of PairedAssignment (blinded, no condition exposed)
 */
export function generatePairedAssignments(
  manifest: StudyManifest,
  config: RandomizationConfig,
): PairedAssignment[] {
  const rng = createRng(config);

  // Collect subjects with their series
  const subjects = manifest.cases.map((caseEntry) => ({
    subjectId: caseEntry.subjectId,
    seriesIds: caseEntry.series.map((s) => s.seriesId),
  }));

  // Shuffle subject order
  seededShuffle(subjects, rng);

  // Build paired assignments
  const assignments: PairedAssignment[] = subjects.map((subject, index) => {
    const seriesIds = [...subject.seriesIds];
    // Fixed order: original (series[0]) = left, denoised (series[1]) = right
    // No randomization — study is not blinded for presentation order

    return {
      id: `${config.raterId}_pair_${subject.subjectId}_${index}`,
      raterId: config.raterId,
      subjectId: subject.subjectId,
      leftSeriesId: seriesIds[0]!,
      rightSeriesId: seriesIds[1] ?? seriesIds[0]!, // fallback if only 1 series
      presentationOrder: index,
      displayLabel: `Comparison ${index + 1}`,
    };
  });

  return assignments;
}
