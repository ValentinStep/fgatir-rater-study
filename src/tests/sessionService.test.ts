/**
 * Tests for the SessionService — restore, advance, completion detection,
 * in-progress save, and item-open time tracking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionService, buildAssignments } from '@/services/sessionService';
import { LocalRatingService } from '@/services/ratingService';
import type { Assignment, SessionState, StudyManifest } from '@/types';

// Mock the ratingService module to use our controlled instance
vi.mock('@/services/ratingService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/ratingService')>();
  const mockInstance = new actual.LocalRatingService();
  return {
    ...actual,
    getRatingService: () => mockInstance,
  };
});

// --- Test Helpers ---

function createTestManifest(): StudyManifest {
  return {
    version: '1.0.0-test',
    cases: [
      {
        subjectId: 'SUB_001',
        series: [
          {
            seriesId: 'ser_aaa111',
            sliceCount: 5,
            rows: 256,
            columns: 256,
            bitsAllocated: 16,
            bitsStored: 12,
            windowCenter: 40,
            windowWidth: 80,
            transferSyntaxUID: '1.2.840.10008.1.2.1',
          },
          {
            seriesId: 'ser_bbb222',
            sliceCount: 5,
            rows: 256,
            columns: 256,
            bitsAllocated: 16,
            bitsStored: 12,
            windowCenter: 40,
            windowWidth: 80,
            transferSyntaxUID: '1.2.840.10008.1.2.1',
          },
        ],
      },
      {
        subjectId: 'SUB_002',
        series: [
          {
            seriesId: 'ser_ccc333',
            sliceCount: 10,
            rows: 512,
            columns: 512,
            bitsAllocated: 16,
            bitsStored: 16,
            windowCenter: 21,
            windowWidth: 54,
            transferSyntaxUID: '1.2.840.10008.1.2.1',
          },
          {
            seriesId: 'ser_ddd444',
            sliceCount: 10,
            rows: 512,
            columns: 512,
            bitsAllocated: 16,
            bitsStored: 16,
            windowCenter: 21,
            windowWidth: 54,
            transferSyntaxUID: '1.2.840.10008.1.2.1',
          },
        ],
      },
    ],
  };
}

function createTestAssignments(): Assignment[] {
  return [
    {
      id: 'assign_001',
      raterId: 'test-rater',
      seriesId: 'ser_aaa111',
      caseSubjectId: 'SUB_001',
      presentationOrder: 0,
      displayLabel: 'Image set 1',
    },
    {
      id: 'assign_002',
      raterId: 'test-rater',
      seriesId: 'ser_ccc333',
      caseSubjectId: 'SUB_002',
      presentationOrder: 1,
      displayLabel: 'Image set 2',
    },
    {
      id: 'assign_003',
      raterId: 'test-rater',
      seriesId: 'ser_bbb222',
      caseSubjectId: 'SUB_001',
      presentationOrder: 2,
      displayLabel: 'Image set 3',
    },
    {
      id: 'assign_004',
      raterId: 'test-rater',
      seriesId: 'ser_ddd444',
      caseSubjectId: 'SUB_002',
      presentationOrder: 3,
      displayLabel: 'Image set 4',
    },
  ];
}

describe('SessionService', () => {
  let service: SessionService;
  const RATER_ID = 'test-rater';
  const assignments = createTestAssignments();

  beforeEach(() => {
    localStorage.clear();
    service = new SessionService(RATER_ID, assignments);
  });

  describe('constructor and getters', () => {
    it('reports total assignments', () => {
      expect(service.getTotalAssignments()).toBe(4);
    });

    it('returns a copy of all assignments', () => {
      const result = service.getAssignments();
      expect(result).toHaveLength(4);
      expect(result).not.toBe(assignments); // should be a copy
      expect(result).toEqual(assignments);
    });

    it('returns assignment at specific index', () => {
      expect(service.getAssignment(0)).toEqual(assignments[0]);
      expect(service.getAssignment(3)).toEqual(assignments[3]);
    });

    it('returns undefined for out-of-range index', () => {
      expect(service.getAssignment(10)).toBeUndefined();
      expect(service.getAssignment(-1)).toBeUndefined();
    });
  });

  describe('restoreOrInitSession', () => {
    it('creates a fresh session when none exists', async () => {
      const session = await service.restoreOrInitSession();

      expect(session.raterId).toBe(RATER_ID);
      expect(session.currentAssignmentIndex).toBe(0);
      expect(session.completedAssignmentIds).toEqual([]);
      expect(session.inProgressResponses).toEqual([]);
      expect(session.itemOpenTime).toBeNull();
      expect(session.lastUpdated).toBeTruthy();
    });

    it('restores an existing session from storage', async () => {
      // Create a session first
      const initialSession = await service.restoreOrInitSession();

      // Advance once
      const advanced = await service.advanceToNext(initialSession, 'assign_001');

      // Create a new service instance — should restore
      const newService = new SessionService(RATER_ID, assignments);
      const restored = await newService.restoreOrInitSession();

      expect(restored.currentAssignmentIndex).toBe(advanced.currentAssignmentIndex);
      expect(restored.completedAssignmentIds).toContain('assign_001');
    });

    it('caps session index if past all assignments', async () => {
      // Manually save a session with an out-of-range index
      const ratingService = new LocalRatingService();
      const badSession: SessionState = {
        raterId: RATER_ID,
        currentAssignmentIndex: 999,
        completedAssignmentIds: [],
        inProgressResponses: [],
        itemOpenTime: null,
        lastUpdated: new Date().toISOString(),
      };
      await ratingService.saveSessionState(badSession);

      const restored = await service.restoreOrInitSession();
      // Should be capped to total assignments length
      expect(restored.currentAssignmentIndex).toBe(assignments.length);
    });
  });

  describe('advanceToNext', () => {
    it('increments current assignment index', async () => {
      const session = await service.restoreOrInitSession();
      const next = await service.advanceToNext(session, 'assign_001');

      expect(next.currentAssignmentIndex).toBe(1);
    });

    it('adds completed assignment ID to list', async () => {
      const session = await service.restoreOrInitSession();
      const next = await service.advanceToNext(session, 'assign_001');

      expect(next.completedAssignmentIds).toContain('assign_001');
    });

    it('clears in-progress responses', async () => {
      const session = await service.restoreOrInitSession();
      // Simulate in-progress state
      const withProgress = await service.saveInProgress(session, [
        { questionId: 'q1', value: 4 },
      ]);
      expect(withProgress.inProgressResponses).toHaveLength(1);

      // Advance should clear them
      const next = await service.advanceToNext(withProgress, 'assign_001');
      expect(next.inProgressResponses).toEqual([]);
    });

    it('clears itemOpenTime', async () => {
      const session = await service.restoreOrInitSession();
      const withOpenTime = await service.recordItemOpen(session);
      expect(withOpenTime.itemOpenTime).not.toBeNull();

      const next = await service.advanceToNext(withOpenTime, 'assign_001');
      expect(next.itemOpenTime).toBeNull();
    });

    it('updates lastUpdated timestamp', async () => {
      const session = await service.restoreOrInitSession();
      const before = session.lastUpdated;

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const next = await service.advanceToNext(session, 'assign_001');
      expect(next.lastUpdated).not.toBe(before);
    });

    it('allows sequential advancement through all assignments', async () => {
      let session = await service.restoreOrInitSession();

      for (let i = 0; i < assignments.length; i++) {
        session = await service.advanceToNext(session, assignments[i]!.id);
      }

      expect(session.currentAssignmentIndex).toBe(assignments.length);
      expect(session.completedAssignmentIds).toHaveLength(assignments.length);
    });
  });

  describe('saveInProgress', () => {
    it('saves in-progress responses to session', async () => {
      const session = await service.restoreOrInitSession();
      const responses = [
        { questionId: 'q1', value: 3 },
        { questionId: 'q2', value: 5 },
      ];

      const updated = await service.saveInProgress(session, responses);
      expect(updated.inProgressResponses).toEqual(responses);
    });

    it('overwrites previously saved in-progress responses', async () => {
      const session = await service.restoreOrInitSession();
      const first = await service.saveInProgress(session, [
        { questionId: 'q1', value: 2 },
      ]);

      const second = await service.saveInProgress(first, [
        { questionId: 'q1', value: 4 },
        { questionId: 'q2', value: 5 },
      ]);

      expect(second.inProgressResponses).toHaveLength(2);
      expect(second.inProgressResponses[0]!.value).toBe(4);
    });
  });

  describe('recordItemOpen', () => {
    it('records the item open time as ISO string', async () => {
      const session = await service.restoreOrInitSession();
      const updated = await service.recordItemOpen(session);

      expect(updated.itemOpenTime).not.toBeNull();
      expect(new Date(updated.itemOpenTime!).toISOString()).toBe(updated.itemOpenTime);
    });
  });

  describe('isStudyComplete', () => {
    it('returns false when there are remaining assignments', async () => {
      const session = await service.restoreOrInitSession();
      expect(service.isStudyComplete(session)).toBe(false);
    });

    it('returns true when all assignments are completed', async () => {
      let session = await service.restoreOrInitSession();
      for (let i = 0; i < assignments.length; i++) {
        session = await service.advanceToNext(session, assignments[i]!.id);
      }
      expect(service.isStudyComplete(session)).toBe(true);
    });

    it('returns true when index equals assignment count', () => {
      const session: SessionState = {
        raterId: RATER_ID,
        currentAssignmentIndex: assignments.length,
        completedAssignmentIds: assignments.map((a) => a.id),
        inProgressResponses: [],
        itemOpenTime: null,
        lastUpdated: new Date().toISOString(),
      };
      expect(service.isStudyComplete(session)).toBe(true);
    });
  });

  describe('isAssignmentCompleted', () => {
    it('returns false for uncompleted assignment', async () => {
      const session = await service.restoreOrInitSession();
      expect(service.isAssignmentCompleted(session, 'assign_001')).toBe(false);
    });

    it('returns true for completed assignment', async () => {
      const session = await service.restoreOrInitSession();
      const advanced = await service.advanceToNext(session, 'assign_001');
      expect(service.isAssignmentCompleted(advanced, 'assign_001')).toBe(true);
    });
  });

  describe('getCurrentAssignment', () => {
    it('returns first assignment for fresh session', async () => {
      const session = await service.restoreOrInitSession();
      const current = service.getCurrentAssignment(session);
      expect(current).toEqual(assignments[0]);
    });

    it('returns correct assignment after advancing', async () => {
      const session = await service.restoreOrInitSession();
      const advanced = await service.advanceToNext(session, 'assign_001');
      const current = service.getCurrentAssignment(advanced);
      expect(current).toEqual(assignments[1]);
    });

    it('returns null when study is complete', async () => {
      let session = await service.restoreOrInitSession();
      for (let i = 0; i < assignments.length; i++) {
        session = await service.advanceToNext(session, assignments[i]!.id);
      }
      const current = service.getCurrentAssignment(session);
      expect(current).toBeNull();
    });
  });
});

describe('buildAssignments', () => {
  const manifest = createTestManifest();

  it('produces assignments for all series in manifest', () => {
    const assignments = buildAssignments(manifest, 'rater-1');
    // 2 cases × 2 series = 4 assignments
    expect(assignments).toHaveLength(4);
  });

  it('assigns correct raterId to all assignments', () => {
    const assignments = buildAssignments(manifest, 'rater-1');
    for (const assignment of assignments) {
      expect(assignment.raterId).toBe('rater-1');
    }
  });

  it('produces unique assignment IDs', () => {
    const assignments = buildAssignments(manifest, 'rater-1');
    const ids = assignments.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes all series IDs from manifest', () => {
    const assignments = buildAssignments(manifest, 'rater-1');
    const seriesIds = new Set(assignments.map((a) => a.seriesId));
    expect(seriesIds.has('ser_aaa111')).toBe(true);
    expect(seriesIds.has('ser_bbb222')).toBe(true);
    expect(seriesIds.has('ser_ccc333')).toBe(true);
    expect(seriesIds.has('ser_ddd444')).toBe(true);
  });

  it('produces deterministic ordering for same seed', () => {
    const first = buildAssignments(manifest, 'rater-1', 'seed-A');
    const second = buildAssignments(manifest, 'rater-1', 'seed-A');
    expect(first).toEqual(second);
  });

  it('produces different ordering for different seeds', () => {
    const first = buildAssignments(manifest, 'rater-1', 'seed-A');
    const second = buildAssignments(manifest, 'rater-1', 'seed-B');
    // The orders should differ (probabilistically guaranteed for different seeds)
    const firstOrder = first.map((a) => a.seriesId);
    const secondOrder = second.map((a) => a.seriesId);
    // At least one must differ (extremely unlikely to match for different seeds)
    const allSame = firstOrder.every((id, i) => id === secondOrder[i]);
    // This could theoretically fail but won't in practice
    expect(allSame).toBe(false);
  });

  it('uses neutral display labels without condition info', () => {
    const assignments = buildAssignments(manifest, 'rater-1');
    for (const assignment of assignments) {
      const label = assignment.displayLabel.toLowerCase();
      expect(label).not.toContain('original');
      expect(label).not.toContain('denoised');
      expect(label).toMatch(/image set \d+/);
    }
  });
});
