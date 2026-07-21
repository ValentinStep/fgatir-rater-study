// Shared TypeScript type definitions
// Will export types for ratings, cases, raters, and DICOM metadata

/** Placeholder type for a study case */
export interface StudyCase {
  id: string;
  subjectId: string;
  sliceCount: number;
}

/** Placeholder type for a rater */
export interface Rater {
  id: string;
  name: string;
}

/** Placeholder type for a rating submission */
export interface Rating {
  id: string;
  raterId: string;
  caseId: string;
  score: number;
  timestamp: string;
}
