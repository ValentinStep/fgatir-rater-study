/**
 * Rating Service
 *
 * Interface + localStorage implementation for persisting ratings.
 * Handles save/load of rating submissions and session state.
 */

import type { RatingSubmission, SessionState } from '@/types';

// --- Storage Keys ---
const STORAGE_KEYS = {
  ratings: (raterId: string) => `fgatir_ratings_${raterId}`,
  session: (raterId: string) => `fgatir_session_${raterId}`,
} as const;

// --- Interface ---

export interface IRatingService {
  saveRating(submission: RatingSubmission): Promise<void>;
  getRatings(raterId: string): Promise<RatingSubmission[]>;
  getCurrentSession(raterId: string): Promise<SessionState | null>;
  saveSessionState(state: SessionState): Promise<void>;
}

// --- LocalStorage Implementation ---

export class LocalRatingService implements IRatingService {
  /**
   * Save a rating submission.
   * Prevents duplicate submissions for the same assignment.
   */
  async saveRating(submission: RatingSubmission): Promise<void> {
    const key = STORAGE_KEYS.ratings(submission.raterId);
    const existing = this.loadRatings(key);

    // Check for duplicate submission
    const duplicate = existing.find(
      (r) => r.assignmentId === submission.assignmentId,
    );
    if (duplicate) {
      throw new Error(
        `Duplicate submission: assignment ${submission.assignmentId} already rated`,
      );
    }

    existing.push(submission);
    localStorage.setItem(key, JSON.stringify(existing));
  }

  /**
   * Get all ratings for a given rater.
   */
  async getRatings(raterId: string): Promise<RatingSubmission[]> {
    const key = STORAGE_KEYS.ratings(raterId);
    return this.loadRatings(key);
  }

  /**
   * Get the current session state for a rater (for resume behavior).
   */
  async getCurrentSession(raterId: string): Promise<SessionState | null> {
    const key = STORAGE_KEYS.session(raterId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as SessionState;
    } catch {
      // Corrupted data — clear it
      localStorage.removeItem(key);
      return null;
    }
  }

  /**
   * Save session state (progress, in-progress responses).
   */
  async saveSessionState(state: SessionState): Promise<void> {
    const key = STORAGE_KEYS.session(state.raterId);
    localStorage.setItem(key, JSON.stringify(state));
  }

  /**
   * Check if a specific assignment has already been rated.
   */
  async isAssignmentRated(
    raterId: string,
    assignmentId: string,
  ): Promise<boolean> {
    const ratings = await this.getRatings(raterId);
    return ratings.some((r) => r.assignmentId === assignmentId);
  }

  /**
   * Clear all data for a rater (useful for testing/reset).
   */
  async clearRaterData(raterId: string): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.ratings(raterId));
    localStorage.removeItem(STORAGE_KEYS.session(raterId));
  }

  // --- Private helpers ---

  private loadRatings(key: string): RatingSubmission[] {
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    try {
      return JSON.parse(raw) as RatingSubmission[];
    } catch {
      return [];
    }
  }
}

// --- Singleton ---

let ratingServiceInstance: LocalRatingService | null = null;

export function getRatingService(): LocalRatingService {
  if (!ratingServiceInstance) {
    ratingServiceInstance = new LocalRatingService();
  }
  return ratingServiceInstance;
}
