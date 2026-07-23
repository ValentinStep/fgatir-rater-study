/**
 * Study-level configuration.
 * Controls study behavior, display, and feature flags.
 */

/** Display mode for the viewer */
export type DisplayMode = 'sequential' | 'sideBySide';

export interface StudyConfig {
  /** Display name shown in the progress header */
  displayName: string;
  /**
   * Display mode:
   * - 'sequential': One series at a time, blinded, each series is a separate assignment
   * - 'sideBySide': Two viewports side-by-side for the same subject, synchronized scrolling/W/L
   */
  displayMode: DisplayMode;
  /** Whether raters can navigate back to previously rated items */
  allowPreviousItemReview: boolean;
  /** Whether comments are required (overrides per-question config) */
  requireComments: boolean;
  /** Dev-mode rater ID for local testing */
  devRaterId: string;
  /** Deterministic randomization seed for assignment ordering */
  randomizationSeed: string;
  /** Feature flags */
  features: {
    /** Show diagnostic panel (Ctrl+Shift+D) */
    diagnosticPanel: boolean;
    /** Enable keyboard shortcuts for rating form */
    keyboardNavigation: boolean;
    /** Warn before leaving with unsaved changes */
    unsavedChangesWarning: boolean;
    /** Auto-save in-progress responses to localStorage */
    autoSaveInProgress: boolean;
  };
}

export const STUDY_CONFIG: StudyConfig = {
  displayName: 'Image Quality Assessment',
  displayMode: 'sideBySide',
  allowPreviousItemReview: false,
  requireComments: false,
  devRaterId: 'dev-rater-001',
  randomizationSeed: 'fgatir-study-2024-v1',
  features: {
    diagnosticPanel: true,
    keyboardNavigation: true,
    unsavedChangesWarning: true,
    autoSaveInProgress: true,
  },
};
