/**
 * Study-level configuration.
 * Controls study behavior, display, and feature flags.
 */

export interface StudyConfig {
  /** Display name shown in the progress header */
  displayName: string;
  /** Whether raters can navigate back to previously rated items */
  allowPreviousItemReview: boolean;
  /** Whether comments are required (overrides per-question config) */
  requireComments: boolean;
  /** Dev-mode rater ID for local testing */
  devRaterId: string;
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
  allowPreviousItemReview: false,
  requireComments: false,
  devRaterId: 'dev-rater-001',
  features: {
    diagnosticPanel: true,
    keyboardNavigation: true,
    unsavedChangesWarning: true,
    autoSaveInProgress: true,
  },
};
