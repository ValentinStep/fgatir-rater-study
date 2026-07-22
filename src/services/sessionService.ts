/**
 * Session Service
 *
 * Manages the study flow — tracks which series have been rated,
 * determines next series to present, and handles resume behavior.
 */

import type {
  Assignment,
  SessionState,
  RatingResponse,
  StudyManifest,
  RandomizationConfig,
  RandomizedAssignment,
} from '@/types';
import { getRatingService } from './ratingService';
import { generateAssignments } from '@/utils/assignmentGenerator';
import { STUDY_CONFIG } from '@/config/studyConfig';

// --- Build assignments from manifest ---

/**
 * Build a randomized list of assignments from the manifest.
 * Uses deterministic seeded randomization for reproducibility.
 *
 * @param manifest - Study manifest (blinded, no condition info)
 * @param raterId - Unique rater identifier
 * @param seed - Optional override seed (defaults to STUDY_CONFIG.randomizationSeed)
 */
export function buildAssignments(
  manifest: StudyManifest,
  raterId: string,
  seed?: string,
): Assignment[] {
  const config: RandomizationConfig = {
    seed: seed ?? STUDY_CONFIG.randomizationSeed,
    raterId,
  };

  const randomized: RandomizedAssignment[] = generateAssignments(manifest, config);

  // Map RandomizedAssignment → Assignment (keeping field naming consistent)
  return randomized.map((ra) => ({
    id: ra.id,
    raterId: ra.raterId,
    seriesId: ra.seriesId,
    caseSubjectId: ra.subjectId,
    presentationOrder: ra.presentationOrder,
    displayLabel: ra.displayLabel,
  }));
}

// --- Session Service Class ---

export class SessionService {
  private raterId: string;
  private assignments: Assignment[];

  constructor(raterId: string, assignments: Assignment[]) {
    this.raterId = raterId;
    this.assignments = assignments;
  }

  /**
   * Get total number of assignments.
   */
  getTotalAssignments(): number {
    return this.assignments.length;
  }

  /**
   * Get all assignments.
   */
  getAssignments(): Assignment[] {
    return [...this.assignments];
  }

  /**
   * Get assignment at a specific index.
   */
  getAssignment(index: number): Assignment | undefined {
    return this.assignments[index];
  }

  /**
   * Restore or initialize session state.
   * If a session exists in storage, restore it.
   * Otherwise, create a fresh session.
   */
  async restoreOrInitSession(): Promise<SessionState> {
    const service = getRatingService();
    const existing = await service.getCurrentSession(this.raterId);

    if (existing) {
      // Validate the restored session makes sense with current assignments
      const maxIndex = this.assignments.length;
      if (existing.currentAssignmentIndex < maxIndex) {
        return existing;
      }
      // Session is past all assignments — mark as complete
      return {
        ...existing,
        currentAssignmentIndex: maxIndex,
      };
    }

    // Fresh session
    const freshSession: SessionState = {
      raterId: this.raterId,
      currentAssignmentIndex: 0,
      completedAssignmentIds: [],
      inProgressResponses: [],
      itemOpenTime: null,
      lastUpdated: new Date().toISOString(),
    };

    await service.saveSessionState(freshSession);
    return freshSession;
  }

  /**
   * Mark the current assignment as complete and advance to next.
   * Returns the updated session state.
   */
  async advanceToNext(
    currentSession: SessionState,
    completedAssignmentId: string,
  ): Promise<SessionState> {
    const service = getRatingService();

    const updatedSession: SessionState = {
      ...currentSession,
      currentAssignmentIndex: currentSession.currentAssignmentIndex + 1,
      completedAssignmentIds: [
        ...currentSession.completedAssignmentIds,
        completedAssignmentId,
      ],
      inProgressResponses: [],
      itemOpenTime: null,
      lastUpdated: new Date().toISOString(),
    };

    await service.saveSessionState(updatedSession);
    return updatedSession;
  }

  /**
   * Save in-progress responses (auto-save).
   */
  async saveInProgress(
    currentSession: SessionState,
    responses: RatingResponse[],
  ): Promise<SessionState> {
    const service = getRatingService();

    const updatedSession: SessionState = {
      ...currentSession,
      inProgressResponses: responses,
      lastUpdated: new Date().toISOString(),
    };

    await service.saveSessionState(updatedSession);
    return updatedSession;
  }

  /**
   * Record when an item is opened (for duration tracking).
   */
  async recordItemOpen(currentSession: SessionState): Promise<SessionState> {
    const service = getRatingService();

    const updatedSession: SessionState = {
      ...currentSession,
      itemOpenTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    await service.saveSessionState(updatedSession);
    return updatedSession;
  }

  /**
   * Check if the study is complete (all assignments rated).
   */
  isStudyComplete(session: SessionState): boolean {
    return session.currentAssignmentIndex >= this.assignments.length;
  }

  /**
   * Check if a specific assignment has already been completed.
   */
  isAssignmentCompleted(
    session: SessionState,
    assignmentId: string,
  ): boolean {
    return session.completedAssignmentIds.includes(assignmentId);
  }

  /**
   * Get the current assignment based on session state.
   */
  getCurrentAssignment(session: SessionState): Assignment | null {
    if (this.isStudyComplete(session)) return null;
    return this.assignments[session.currentAssignmentIndex] ?? null;
  }
}
