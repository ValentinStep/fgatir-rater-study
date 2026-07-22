/**
 * Supabase Rating Service
 *
 * Implements IRatingService for persisting ratings and session state
 * to Supabase. Falls back gracefully on network errors.
 *
 * NOTE: This is a stub implementation. It requires a configured Supabase
 * instance with the FGATIR schema. For local development, use
 * LocalRatingService instead.
 */

import type { RatingSubmission, SessionState } from '@/types';
import type { IRatingService } from './ratingService';
import { getSupabaseClient } from './supabaseClient';

/** Maximum number of retry attempts for transient network errors */
const MAX_RETRIES = 2;

/** Delay between retries in milliseconds */
const RETRY_DELAY_MS = 1000;

/** Shape of a rating row returned from the database */
interface RatingRow {
  id: string;
  assignment_id: string;
  rater_id: string;
  series_id: string;
  responses_json: unknown;
  viewer_state_json: unknown;
  started_at: string | null;
  submitted_at: string;
  duration_seconds: number | null;
  created_at: string;
}

export class SupabaseRatingService implements IRatingService {
  /**
   * Save a rating submission to the ratings table.
   * Also marks the assignment as completed.
   */
  async saveRating(submission: RatingSubmission): Promise<void> {
    const supabase = getSupabaseClient();

    // Calculate duration in seconds
    const durationSeconds = submission.durationMs / 1000;

    // Insert rating
    const { error: ratingError } = await this.withRetry(async () =>
      supabase.from('ratings').insert({
        assignment_id: submission.assignmentId,
        rater_id: submission.raterId,
        series_id: submission.seriesId,
        responses_json: submission.responses as unknown as Record<string, unknown>,
        started_at: submission.itemOpenTime,
        submitted_at: submission.submissionTime,
        duration_seconds: durationSeconds,
        viewer_state_json: submission.viewerState as unknown as Record<string, unknown>,
      } as never),
    );

    if (ratingError) {
      // Check for duplicate submission (unique constraint violation)
      if (ratingError.code === '23505') {
        throw new Error(
          `Duplicate submission: assignment ${submission.assignmentId} already rated`,
        );
      }
      throw new Error(`Failed to save rating: ${ratingError.message}`);
    }

    // Update assignment status to completed
    const { error: assignmentError } = await this.withRetry(async () =>
      supabase
        .from('assignments')
        .update({
          status: 'completed',
          completed_at: submission.submissionTime,
        } as never)
        .eq('id', submission.assignmentId),
    );

    if (assignmentError) {
      // Non-fatal: rating was saved, log warning
      console.warn(
        `Rating saved but failed to update assignment status: ${assignmentError.message}`,
      );
    }
  }

  /**
   * Get all ratings for a given rater from the ratings table.
   */
  async getRatings(raterId: string): Promise<RatingSubmission[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await this.withRetry(async () =>
      supabase
        .from('ratings')
        .select('*')
        .eq('rater_id', raterId)
        .order('submitted_at', { ascending: true }),
    );

    if (error) {
      throw new Error(`Failed to fetch ratings: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    // Map database rows to RatingSubmission objects
    const rows = data as unknown as RatingRow[];
    return rows.map((row) => ({
      id: row.id,
      raterId: row.rater_id,
      assignmentId: row.assignment_id,
      seriesId: row.series_id,
      responses: Array.isArray(row.responses_json)
        ? (row.responses_json as unknown as RatingSubmission['responses'])
        : [],
      viewerState: (row.viewer_state_json ?? {
        currentSlice: 0,
        totalSlices: 0,
        windowCenter: 0,
        windowWidth: 0,
        zoom: 1,
      }) as unknown as RatingSubmission['viewerState'],
      itemOpenTime: row.started_at ?? row.created_at,
      submissionTime: row.submitted_at,
      durationMs: (row.duration_seconds ?? 0) * 1000,
    }));
  }

  /**
   * Get current session state.
   * Session state is stored in localStorage even in Supabase mode,
   * since it's ephemeral and doesn't need server persistence.
   */
  async getCurrentSession(raterId: string): Promise<SessionState | null> {
    const key = `fgatir_session_${raterId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as SessionState;
    } catch {
      localStorage.removeItem(key);
      return null;
    }
  }

  /**
   * Save session state to localStorage.
   * Session state is local-only (ephemeral progress tracking).
   */
  async saveSessionState(state: SessionState): Promise<void> {
    const key = `fgatir_session_${state.raterId}`;
    localStorage.setItem(key, JSON.stringify(state));
  }

  // --- Private Helpers ---

  /**
   * Retry wrapper for transient network errors.
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    retries = MAX_RETRIES,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err;

        // Only retry on network-type errors
        if (attempt < retries && this.isRetryableError(err)) {
          await this.delay(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }

        throw err;
      }
    }

    throw lastError;
  }

  /**
   * Determine if an error is retryable (network timeout, etc.)
   */
  private isRetryableError(err: unknown): boolean {
    if (err instanceof TypeError && err.message.includes('fetch')) {
      return true; // Network error
    }
    if (
      err instanceof Error &&
      (err.message.includes('network') ||
        err.message.includes('timeout') ||
        err.message.includes('ECONNRESET'))
    ) {
      return true;
    }
    return false;
  }

  /**
   * Promise-based delay.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
