/**
 * Rating questions configuration.
 * Defines all questions presented to raters for each image series.
 * Uses neutral wording — does not indicate expected outcomes.
 */

import type { RatingQuestion } from '@/types';

export const RATING_QUESTIONS: RatingQuestion[] = [
  {
    id: 'overall_quality',
    type: 'likert',
    label: 'Overall image quality',
    helpText: 'Rate the overall quality of the displayed image series.',
    required: true,
    order: 1,
    min: 1,
    max: 5,
    minLabel: 'Very poor',
    maxLabel: 'Excellent',
  },
  {
    id: 'perceived_noise',
    type: 'likert',
    label: 'Perceived image noise',
    helpText: 'Rate the level of noise visible in the image.',
    required: true,
    order: 2,
    min: 1,
    max: 5,
    minLabel: 'Excessive noise',
    maxLabel: 'No visible noise',
  },
  {
    id: 'anatomic_sharpness',
    type: 'likert',
    label: 'Anatomic sharpness',
    helpText: 'Rate the sharpness of anatomical structures.',
    required: true,
    order: 3,
    min: 1,
    max: 5,
    minLabel: 'Very blurry',
    maxLabel: 'Very sharp',
  },
  {
    id: 'artifacts',
    type: 'likert',
    label: 'Artifacts',
    helpText: 'Rate the presence and severity of image artifacts.',
    required: true,
    order: 4,
    min: 1,
    max: 5,
    minLabel: 'Severe artifacts',
    maxLabel: 'No artifacts',
  },
  {
    id: 'diagnostic_confidence',
    type: 'likert',
    label: 'Diagnostic confidence',
    helpText: 'Rate your confidence in making a diagnostic assessment from this image.',
    required: true,
    order: 5,
    min: 1,
    max: 5,
    minLabel: 'Not confident',
    maxLabel: 'Very confident',
  },
  {
    id: 'comments',
    type: 'text',
    label: 'Comments',
    helpText: 'Optional free-text comments about this image series.',
    required: false,
    order: 6,
    maxLength: 1000,
    placeholder: 'Enter any additional observations (optional)',
  },
];

/** Get all required question IDs */
export function getRequiredQuestionIds(): string[] {
  return RATING_QUESTIONS.filter((q) => q.required).map((q) => q.id);
}

/** Validate that a set of responses satisfies all required questions */
export function validateResponses(
  responses: { questionId: string; value: number | string | boolean | null }[],
): { valid: boolean; missingIds: string[] } {
  const requiredIds = getRequiredQuestionIds();
  const answeredIds = new Set(
    responses
      .filter((r) => r.value !== null && r.value !== '')
      .map((r) => r.questionId),
  );

  const missingIds = requiredIds.filter((id) => !answeredIds.has(id));
  return { valid: missingIds.length === 0, missingIds };
}
