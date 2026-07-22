/**
 * Tests for rating service — localStorage persistence,
 * session management, and duplicate prevention.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LocalRatingService } from '@/services/ratingService';
import type { RatingSubmission, SessionState } from '@/types';

function createMockSubmission(overrides: Partial<RatingSubmission> = {}): RatingSubmission {
  return {
    id: 'sub_001',
    raterId: 'test-rater',
    assignmentId: 'assign_001',
    seriesId: 'series_001',
    responses: [
      { questionId: 'q1', value: 4 },
      { questionId: 'q2', value: 3 },
    ],
    viewerState: {
      currentSlice: 5,
      totalSlices: 10,
      windowCenter: 40,
      windowWidth: 80,
      zoom: 1,
    },
    itemOpenTime: '2024-01-01T10:00:00.000Z',
    submissionTime: '2024-01-01T10:05:00.000Z',
    durationMs: 300000,
    ...overrides,
  };
}

function createMockSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    raterId: 'test-rater',
    currentAssignmentIndex: 0,
    completedAssignmentIds: [],
    inProgressResponses: [],
    itemOpenTime: null,
    lastUpdated: '2024-01-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('LocalRatingService', () => {
  let service: LocalRatingService;

  beforeEach(() => {
    localStorage.clear();
    service = new LocalRatingService();
  });

  describe('saveRating', () => {
    it('saves a rating submission to localStorage', async () => {
      const submission = createMockSubmission();
      await service.saveRating(submission);

      const ratings = await service.getRatings('test-rater');
      expect(ratings).toHaveLength(1);
      expect(ratings[0]).toEqual(submission);
    });

    it('saves multiple ratings', async () => {
      await service.saveRating(createMockSubmission({ id: 'sub_001', assignmentId: 'a1' }));
      await service.saveRating(createMockSubmission({ id: 'sub_002', assignmentId: 'a2' }));

      const ratings = await service.getRatings('test-rater');
      expect(ratings).toHaveLength(2);
    });

    it('prevents duplicate submissions for the same assignment', async () => {
      const submission = createMockSubmission();
      await service.saveRating(submission);

      await expect(
        service.saveRating(createMockSubmission({ id: 'sub_002' })),
      ).rejects.toThrow(/Duplicate submission/);
    });
  });

  describe('getRatings', () => {
    it('returns empty array for a rater with no ratings', async () => {
      const ratings = await service.getRatings('nonexistent');
      expect(ratings).toEqual([]);
    });

    it('persists across service instances', async () => {
      await service.saveRating(createMockSubmission());

      // Create new service instance
      const newService = new LocalRatingService();
      const ratings = await newService.getRatings('test-rater');
      expect(ratings).toHaveLength(1);
    });
  });

  describe('session state', () => {
    it('saves and retrieves session state', async () => {
      const session = createMockSession();
      await service.saveSessionState(session);

      const retrieved = await service.getCurrentSession('test-rater');
      expect(retrieved).toEqual(session);
    });

    it('returns null for nonexistent session', async () => {
      const session = await service.getCurrentSession('nonexistent');
      expect(session).toBeNull();
    });

    it('updates session state', async () => {
      const session = createMockSession();
      await service.saveSessionState(session);

      const updated = createMockSession({
        currentAssignmentIndex: 1,
        completedAssignmentIds: ['assign_001'],
      });
      await service.saveSessionState(updated);

      const retrieved = await service.getCurrentSession('test-rater');
      expect(retrieved?.currentAssignmentIndex).toBe(1);
      expect(retrieved?.completedAssignmentIds).toContain('assign_001');
    });

    it('persists session across service instances', async () => {
      const session = createMockSession({ currentAssignmentIndex: 2 });
      await service.saveSessionState(session);

      const newService = new LocalRatingService();
      const retrieved = await newService.getCurrentSession('test-rater');
      expect(retrieved?.currentAssignmentIndex).toBe(2);
    });
  });

  describe('isAssignmentRated', () => {
    it('returns false if assignment is not rated', async () => {
      const result = await service.isAssignmentRated('test-rater', 'assign_001');
      expect(result).toBe(false);
    });

    it('returns true if assignment is rated', async () => {
      await service.saveRating(createMockSubmission());
      const result = await service.isAssignmentRated('test-rater', 'assign_001');
      expect(result).toBe(true);
    });
  });

  describe('clearRaterData', () => {
    it('clears all data for a rater', async () => {
      await service.saveRating(createMockSubmission());
      await service.saveSessionState(createMockSession());

      await service.clearRaterData('test-rater');

      const ratings = await service.getRatings('test-rater');
      const session = await service.getCurrentSession('test-rater');
      expect(ratings).toEqual([]);
      expect(session).toBeNull();
    });
  });
});
