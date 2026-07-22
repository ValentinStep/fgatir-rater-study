/**
 * Deterministic randomization utilities for blinded study assignment.
 *
 * Uses a seeded PRNG (mulberry32) to produce reproducible randomization
 * given the same seed + raterId combination. No external dependencies.
 */

import type { RandomizationConfig } from '@/types';

// --- Seeded PRNG (mulberry32) ---

/**
 * Generate a 32-bit integer hash from a string using a simple hash function.
 * Used to convert string seeds into numeric seeds for the PRNG.
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0; // Convert to 32-bit int
  }
  // Ensure positive value for PRNG seed
  return hash >>> 0;
}

/**
 * Mulberry32 — a simple, fast, seeded 32-bit PRNG.
 * Returns a function that produces the next random float in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return function () {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a seeded PRNG from a RandomizationConfig.
 * Combines the study seed and raterId to produce a unique but deterministic sequence.
 */
export function createRng(config: RandomizationConfig): () => number {
  const combinedSeed = `${config.seed}::${config.raterId}`;
  const numericSeed = hashString(combinedSeed);
  return mulberry32(numericSeed);
}

// --- Fisher-Yates Shuffle (deterministic) ---

/**
 * Shuffle an array in-place using Fisher-Yates algorithm with a seeded RNG.
 * Returns the same array reference (mutated).
 */
export function seededShuffle<T>(array: T[], rng: () => number): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = array[i]!;
    array[i] = array[j]!;
    array[j] = temp;
  }
  return array;
}

// --- Anti-consecutive constraint ---

/**
 * Item with a group identifier (subjectId) for anti-consecutive ordering.
 */
interface GroupedItem<T> {
  item: T;
  groupId: string;
}

/**
 * Check if anti-consecutive constraint is satisfiable.
 * It's satisfiable when the largest group has at most ceil(total / 2) items.
 */
function isAntiConsecutivePossible<T>(items: GroupedItem<T>[]): boolean {
  const counts = new Map<string, number>();
  for (const { groupId } of items) {
    counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
  }
  const maxCount = Math.max(...counts.values());
  return maxCount <= Math.ceil(items.length / 2);
}

/**
 * Reorder items so that items from the same group are not adjacent when possible.
 * Uses a deterministic greedy approach: always pick from the largest remaining
 * group that differs from the previous item's group.
 *
 * If the constraint cannot be fully satisfied (e.g., only one group),
 * the result is still valid — just with consecutive same-group items.
 */
export function antiConsecutiveOrder<T>(
  items: GroupedItem<T>[],
  rng: () => number,
): T[] {
  if (items.length <= 1) {
    return items.map((g) => g.item);
  }

  // Group items by groupId
  const groups = new Map<string, T[]>();
  for (const { item, groupId } of items) {
    const existing = groups.get(groupId);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(groupId, [item]);
    }
  }

  // If only one group, just shuffle within the group
  if (groups.size === 1) {
    const allItems = items.map((g) => g.item);
    return seededShuffle(allItems, rng);
  }

  // Shuffle within each group for randomness
  for (const [, arr] of groups) {
    seededShuffle(arr, rng);
  }

  // Determine if constraint is satisfiable
  const canSatisfy = isAntiConsecutivePossible(items);

  // Greedy interleaving: always pick from the LARGEST different group
  // (deterministic tiebreaking with rng for balance)
  const result: T[] = [];
  const groupLookup = new Map<string, string>(); // item → groupId (for repair)
  let lastGroupId: string | null = null;

  while (result.length < items.length) {
    // Find eligible groups (different from lastGroupId, or all if none are different)
    const eligible: [string, T[]][] = [];
    const fallback: [string, T[]][] = [];

    for (const [gid, arr] of groups) {
      if (arr.length === 0) continue;
      if (gid !== lastGroupId) {
        eligible.push([gid, arr]);
      } else {
        fallback.push([gid, arr]);
      }
    }

    const candidates = eligible.length > 0 ? eligible : fallback;
    if (candidates.length === 0) break;

    // Sort candidates by size descending (favor largest group to avoid getting stuck)
    candidates.sort((a, b) => b[1].length - a[1].length);

    // Among the largest (tied) candidates, pick one randomly
    const maxSize = candidates[0]![1].length;
    const tied = candidates.filter((c) => c[1].length === maxSize);
    const chosenIndex = Math.floor(rng() * tied.length);
    const chosen = tied[chosenIndex]!;

    const [chosenGroupId, chosenArr] = chosen;
    const item = chosenArr.shift()!;
    result.push(item);
    groupLookup.set(String(result.length - 1), chosenGroupId);
    lastGroupId = chosenGroupId;

    // Clean up empty groups
    if (chosenArr.length === 0) {
      groups.delete(chosenGroupId);
    }
  }

  // Repair pass: if constraint should be satisfiable but violations exist, swap
  if (canSatisfy) {
    for (let i = 1; i < result.length; i++) {
      const currGroup = groupLookup.get(String(i));
      const prevGroup = groupLookup.get(String(i - 1));
      if (currGroup === prevGroup) {
        // Try to swap with a later non-adjacent item from a different group
        for (let j = i + 1; j < result.length; j++) {
          const jGroup = groupLookup.get(String(j));
          if (jGroup === currGroup) continue;
          // Check that swapping doesn't create new violations
          const iPrevGroup = i > 0 ? groupLookup.get(String(i - 1)) : null;
          const iNextGroup = i < result.length - 1 ? groupLookup.get(String(i + 1)) : null;
          const jPrevGroup = j > 0 ? groupLookup.get(String(j - 1)) : null;
          const jNextGroup = j < result.length - 1 ? groupLookup.get(String(j + 1)) : null;

          // After swap: position i has jGroup, position j has currGroup
          const iOkPrev = iPrevGroup !== jGroup;
          const iOkNext = iNextGroup !== jGroup && !(i + 1 === j);
          const jOkPrev = (j - 1 === i ? jGroup : jPrevGroup) !== currGroup;
          const jOkNext = jNextGroup !== currGroup;

          if (iOkPrev && iOkNext && jOkPrev && jOkNext) {
            // Swap
            const temp = result[i]!;
            result[i] = result[j]!;
            result[j] = temp;
            groupLookup.set(String(i), jGroup!);
            groupLookup.set(String(j), currGroup!);
            break;
          }
        }
      }
    }
  }

  return result;
}
