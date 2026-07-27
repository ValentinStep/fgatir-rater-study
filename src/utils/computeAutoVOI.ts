/**
 * computeAutoVOI.ts
 *
 * Computes an optimal VOI (Value of Interest) range from volume scalar data
 * using percentile-based windowing. This avoids too-bright or too-dark displays
 * by ignoring extreme outliers (background zeros, noise spikes).
 */

export interface VOIRange {
  lower: number;
  upper: number;
}

/**
 * Compute auto-scaled VOI range from a typed array of voxel intensities.
 *
 * Uses P2/P98 percentiles by default — this captures 96% of the data range
 * while excluding background and noise outliers.
 *
 * @param scalarData - The volume's scalar data (any ArrayLike<number>)
 * @param lowerPercentile - Lower percentile (default 0.02 = P2)
 * @param upperPercentile - Upper percentile (default 0.98 = P98)
 * @returns VOIRange with lower and upper bounds
 */
export function computeAutoVOI(
  scalarData: ArrayLike<number>,
  lowerPercentile = 0.02,
  upperPercentile = 0.98,
): VOIRange {
  const length = scalarData.length;

  if (length === 0) {
    return { lower: 0, upper: 100 };
  }

  // For large volumes, subsample to keep percentile computation fast
  // 1M samples is more than enough for accurate percentile estimation
  const MAX_SAMPLES = 1_000_000;
  const samples: number[] = [];

  if (length <= MAX_SAMPLES) {
    // Use all data (filter out exact zeros which are typically background)
    for (let i = 0; i < length; i++) {
      const val = scalarData[i] as number;
      if (val !== 0) {
        samples.push(val);
      }
    }
  } else {
    // Subsample uniformly
    const step = length / MAX_SAMPLES;
    for (let i = 0; i < MAX_SAMPLES; i++) {
      const idx = Math.floor(i * step);
      const val = scalarData[idx] as number;
      if (val !== 0) {
        samples.push(val);
      }
    }
  }

  // If all values are zero (empty volume), return safe defaults
  if (samples.length === 0) {
    return { lower: 0, upper: 100 };
  }

  // Sort for percentile calculation
  samples.sort((a, b) => a - b);

  const lowerIdx = Math.floor(samples.length * lowerPercentile);
  const upperIdx = Math.min(
    Math.floor(samples.length * upperPercentile),
    samples.length - 1,
  );

  const lower = samples[lowerIdx] ?? samples[0] ?? 0;
  const upper = samples[upperIdx] ?? samples[samples.length - 1] ?? 100;

  // Ensure we have at least some range (avoid zero-width window)
  if (upper <= lower) {
    return { lower: lower - 1, upper: lower + 1 };
  }

  return { lower, upper };
}

/**
 * Convert VOI range to traditional window center/width values.
 */
export function voiRangeToWindowLevel(voiRange: VOIRange): {
  windowCenter: number;
  windowWidth: number;
} {
  return {
    windowCenter: Math.round((voiRange.lower + voiRange.upper) / 2),
    windowWidth: Math.round(voiRange.upper - voiRange.lower),
  };
}
