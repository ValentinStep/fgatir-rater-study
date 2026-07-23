// Shared TypeScript type definitions

/** Study manifest loaded from manifest.json */
export interface StudyManifest {
  version: string;
  cases: CaseEntry[];
}

/** A case in the study (one subject) */
export interface CaseEntry {
  subjectId: string;
  series: SeriesEntry[];
}

/** A single series within a case */
export interface SeriesEntry {
  seriesId: string;
  sliceCount: number;
  rows: number;
  columns: number;
  bitsAllocated: number;
  bitsStored: number;
  windowCenter: number;
  windowWidth: number;
  transferSyntaxUID: string;
}

/** Viewport display state */
export interface ViewportState {
  currentSlice: number;
  totalSlices: number;
  windowCenter: number;
  windowWidth: number;
  zoom: number;
}

/** Application view state */
export type AppView = 'loading' | 'viewer' | 'error' | 'complete';

// --- Rating Types ---

/** Question type discriminator */
export type RatingQuestionType = 'likert' | 'categorical' | 'boolean' | 'text';

/** Base question fields shared by all question types */
interface BaseRatingQuestion {
  id: string;
  label: string;
  helpText?: string;
  required: boolean;
  order: number;
}

/** Likert-scale question (e.g., 1–5) */
export interface LikertQuestion extends BaseRatingQuestion {
  type: 'likert';
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
}

/** Categorical (multiple choice) question */
export interface CategoricalQuestion extends BaseRatingQuestion {
  type: 'categorical';
  options: { value: string; label: string }[];
}

/** Boolean (yes/no) question */
export interface BooleanQuestion extends BaseRatingQuestion {
  type: 'boolean';
  trueLabel: string;
  falseLabel: string;
}

/** Free-text question */
export interface TextQuestion extends BaseRatingQuestion {
  type: 'text';
  maxLength?: number;
  placeholder?: string;
}

/** Discriminated union of all question types */
export type RatingQuestion =
  | LikertQuestion
  | CategoricalQuestion
  | BooleanQuestion
  | TextQuestion;

/** Individual answer to a single question */
export interface RatingResponse {
  questionId: string;
  value: number | string | boolean | null;
}

/** Viewer state snapshot captured at submission time */
export interface ViewerStateSnapshot {
  currentSlice: number;
  totalSlices: number;
  windowCenter: number;
  windowWidth: number;
  zoom: number;
}

/** Full set of responses for one series */
export interface RatingSubmission {
  id: string;
  raterId: string;
  assignmentId: string;
  seriesId: string;
  responses: RatingResponse[];
  viewerState: ViewerStateSnapshot;
  itemOpenTime: string; // ISO 8601
  submissionTime: string; // ISO 8601
  durationMs: number;
}

/** Current session state — tracks progress and in-progress work */
export interface SessionState {
  raterId: string;
  currentAssignmentIndex: number;
  completedAssignmentIds: string[];
  inProgressResponses: RatingResponse[];
  itemOpenTime: string | null; // ISO 8601
  lastUpdated: string; // ISO 8601
}

/** Series assignment to a rater with presentation order */
export interface Assignment {
  id: string;
  raterId: string;
  seriesId: string;
  caseSubjectId: string;
  presentationOrder: number;
  displayLabel: string; // e.g., "Image set 1"
}

/** Paired assignment for side-by-side mode — one rating per subject pair */
export interface PairedAssignment {
  id: string;
  raterId: string;
  subjectId: string;
  /** Series ID shown in the left viewport ("Image A") */
  leftSeriesId: string;
  /** Series ID shown in the right viewport ("Image B") */
  rightSeriesId: string;
  presentationOrder: number;
  displayLabel: string; // e.g., "Comparison 1"
}

// --- Randomization Types ---

/** Configuration for deterministic randomization */
export interface RandomizationConfig {
  /** Study-level seed, e.g., "study-2024-fgatir" */
  seed: string;
  /** Unique rater identifier */
  raterId: string;
}

/** A randomized assignment produced by the randomization engine */
export interface RandomizedAssignment {
  id: string;
  raterId: string;
  seriesId: string;
  subjectId: string;
  presentationOrder: number;
  displayLabel: string; // "Image set 1", "Image set 2", etc.
}
